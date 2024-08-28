#!/usr/bin/env python
"""
image_extender.py

This module contains the ImageExtender class, which is responsible for generating
and extending landscape images using a Stable Diffusion model.

Key functionalities:
1. Extending an existing image based on a given prompt
2. Generating a sequence of images for a full day (24 hours)

The class uses the StableDiffusionInpaintPipeline from the diffusers library
to perform image inpainting and extension.
"""

import torch
from PIL import Image, ImageDraw
from diffusers import StableDiffusionInpaintPipeline
from datetime import datetime, timedelta
import os
import json
import sys
import shutil

print(f"Python executable: {sys.executable}")
print(f"Python version: {sys.version}")
print(f"Python path: {sys.path}")

class ImageExtender:
    def __init__(self, model_path="runwayml/stable-diffusion-inpainting"):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        print(f"Using device: {self.device}")
        self.pipe = StableDiffusionInpaintPipeline.from_pretrained(
            model_path,
            torch_dtype=torch.float32
        ).to(self.device)

    def extend_image(self, image_path, prompt, extension_width=512, transition_width=64):
        try:
            print(f"Attempting to open image: {image_path}")
            original_image = Image.open(image_path)
            print(f"Image opened successfully. Format: {original_image.format}, Size: {original_image.size}, Mode: {original_image.mode}")
            original_image = original_image.convert("RGB")
        except (FileNotFoundError, Image.UnidentifiedImageError) as e:
            print(f"Error opening image: {e}")
            # If the image can't be opened, create a blank image
            print("Creating a blank image as fallback")
            original_image = Image.new("RGB", (512, 512), color="white")

        original_width, original_height = original_image.size

        new_width = original_width + extension_width
        new_height = original_height

        canvas = Image.new("RGB", (new_width, new_height))
        canvas.paste(original_image, (0, 0))

        mask = Image.new("L", (new_width, new_height), 0)
        mask_draw = ImageDraw.Draw(mask)
        mask_draw.rectangle([original_width, 0, new_width, new_height], fill=255)

        for x in range(transition_width):
            gradient_value = int(255 * (x / transition_width))
            mask_draw.line([(original_width - transition_width + x, 0), 
                            (original_width - transition_width + x, new_height)], 
                           fill=gradient_value)

        inpaint_area = canvas.crop((original_width - transition_width, 0, new_width, new_height))
        inpaint_mask = mask.crop((original_width - transition_width, 0, new_width, new_height))

        inpaint_area_resized = inpaint_area.resize((512, 512))
        inpaint_mask_resized = inpaint_mask.resize((512, 512))

        print(f"Generating image with prompt: {prompt}")
        inpainted_resized = self.pipe(
            prompt=prompt,
            image=inpaint_area_resized,
            mask_image=inpaint_mask_resized,
            num_inference_steps=50,
            guidance_scale=7.5
        ).images[0]
        inpainted_area = inpainted_resized.resize((extension_width + transition_width, new_height))
        canvas.paste(inpainted_area, (original_width - transition_width, 0))

        return canvas

    def generate_daily_sequence(self, seed_image_path, num_segments, prompts, output_dir, date):
        current_image_path = seed_image_path
        new_paths = []
        
        for i, prompt in enumerate(prompts[:num_segments]):
            print(f"Generating segment {i+1}/{num_segments}")
            new_image = self.extend_image(current_image_path, prompt)
            new_path = os.path.join(output_dir, f"{date}_segment_{i:02d}.png")
            new_image.save(new_path)
            new_paths.append(new_path)
            current_image_path = new_path
        
        # Copy the final segment as the full day landscape
        final_segment_path = new_paths[-1]
        full_day_path = os.path.join(output_dir, f"{date}_full_day_landscape.png")
        shutil.copy2(final_segment_path, full_day_path)
        
        # Save prompts to a text file
        prompts_file_path = os.path.join(output_dir, f"{date}_generated_descriptions.txt")
        with open(prompts_file_path, "w") as f:
            f.write("\n\n".join(prompts))
        print(f"Saved generated descriptions to {prompts_file_path}")
        
        return full_day_path

if __name__ == "__main__":
    seed_image_path = sys.argv[1]
    prompts = json.loads(sys.argv[2])
    output_dir = sys.argv[3]
    date = sys.argv[4]

    extender = ImageExtender()
    full_day_path = extender.generate_daily_sequence(seed_image_path, len(prompts), prompts, output_dir, date)
    
    print(json.dumps({"full_day_path": full_day_path}))