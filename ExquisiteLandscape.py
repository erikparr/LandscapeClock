from langchain.llms import OpenAI
from langchain.prompts import PromptTemplate
from langchain.chains import LLMChain
from PIL import Image
import os
from datetime import datetime, timedelta
from image_extender import ImageExtender

# Initialize the language model
llm = OpenAI(temperature=0.7)

# Create a prompt template for generating landscape descriptions
landscape_prompt = PromptTemplate(
    input_variables=["previous_description", "current_time"],
    template="Generate a single sentence describing a natural landscape at {current_time} that could seamlessly extend the following landscape: {previous_description}. The new description should be different but complementary, and reflect the time of day. At the end of the sentence include that it is a landscape painting."
)

# Create an LLMChain for generating landscape descriptions
landscape_chain = LLMChain(llm=llm, prompt=landscape_prompt)

def get_single_sentence(text):
    """Extract the first sentence from the given text."""
    sentences = text.split('.')
    return sentences[0].strip() + '.'

def crop_image_for_stitching(image_path, index, total_images):
    """Crop images based on their position in the sequence."""
    with Image.open(image_path) as img:
        width, height = img.size
        crop_width = int(width * 0.25)
        
        print(f"Image {index}: Original size = {width}x{height}, Crop width = {crop_width}")
        
        if index == 0:  # First image
            cropped = img.crop((0, 0, width - crop_width, height))
        elif index == total_images - 1:  # Last image
            cropped = img.crop((crop_width, 0, width, height))
        else:  # Middle images
            cropped = img.crop((crop_width, 0, width - crop_width, height))
        
        print(f"Image {index}: Cropped size = {cropped.size}")
        return cropped

def stitch_images(image_paths):
    """Stitch multiple images together horizontally after cropping."""
    total_images = len(image_paths)
    cropped_images = [crop_image_for_stitching(path, i, total_images) for i, path in enumerate(image_paths)]
    widths, heights = zip(*(i.size for i in cropped_images))
    
    print("Cropped image sizes:")
    for i, (w, h) in enumerate(zip(widths, heights)):
        print(f"Image {i}: {w}x{h}")
    
    max_height = max(heights)
    total_width = sum(widths)
    
    stitched_image = Image.new('RGB', (total_width, max_height))
    
    x_offset = 0
    for i, img in enumerate(cropped_images):
        stitched_image.paste(img, (x_offset, 0))
        print(f"Pasting image {i} at x_offset = {x_offset}")
        x_offset += img.size[0]
    
    return stitched_image

def extend_image_sequence(initial_image_path, num_extensions, output_dir, date, extension_width=512, transition_width=64):
    # Initialize the ImageExtender
    extender = ImageExtender()
    
    # Start with the initial image
    current_image_path = initial_image_path
    previous_description = "a natural landscape with trees, desert landscape and wildlife at 9:00 AM"
    
    extended_image_paths = []  # This will now start empty
    generated_descriptions = [previous_description]
    
    # Debug: Print initial image size
    print(f"Initial image size: {Image.open(initial_image_path).size}")
    
    start_time = datetime.strptime("9:00 AM", "%I:%M %p")
    
    for i in range(num_extensions):
        current_time = (start_time + timedelta(hours=i)).strftime("%I:%M %p")
        print(f"Generating extension {i+1}/{num_extensions} for {current_time}")
        
        # Generate a new landscape description and ensure it's a single sentence
        new_description = landscape_chain.run(previous_description=previous_description, current_time=current_time)
        new_description = get_single_sentence(new_description)
        generated_descriptions.append(new_description)
        print(f"Generated description: {new_description}")
        
        # Extend the image
        extended_image = extender.extend_image(current_image_path, new_description, extension_width, transition_width)
        
        # Save the full extended image
        full_extended_path = f"extended_image_{i+1}.png"
        extended_image.save(full_extended_path)
        extended_image_paths.append(full_extended_path)
        print(f"Saved full extended image: {full_extended_path}")
        
        # Debug: Print extended image size
        print(f"Extended image {i+1} size: {extended_image.size}")
        
        # Crop the rightmost 512x512 area from the extended image
        new_width, new_height = extended_image.size
        cropped_image = extended_image.crop((new_width - 512, 0, new_width, 512))
        
        # Save the cropped image
        cropped_path = f"cropped_image_{i+1}.png"
        cropped_image.save(cropped_path)
        print(f"Saved cropped image: {cropped_path}")
        
        # Debug: Print cropped image size
        print(f"Cropped image {i+1} size: {cropped_image.size}")
        
        # Update for next iteration
        current_image_path = cropped_path
        previous_description = new_description

    print("Image extension sequence completed.")
    
    # Stitch all extended images together
    stitched_image = stitch_images(extended_image_paths)
    stitched_image_path = "stitched_landscape.png"
    stitched_image.save(stitched_image_path)
    print(f"Saved stitched landscape image: {stitched_image_path}")
    
    # Debug: Print stitched image size
    print(f"Stitched image size: {stitched_image.size}")

    # Save generated descriptions to a text file in the output directory
    descriptions_file_path = os.path.join(output_dir, f"{date}_generated_descriptions.txt")
    with open(descriptions_file_path, "w") as f:
        f.write("\n\n".join(generated_descriptions))
    print(f"Saved generated descriptions to {descriptions_file_path}")

# Usage example
if __name__ == "__main__":
    initial_image_path = "input_image.png"
    num_extensions = 24
    output_dir = "static/images/2023-05-25"  # Replace with the actual output directory
    date = "2023-05-25"  # Replace with the actual date
    os.makedirs(output_dir, exist_ok=True)
    extend_image_sequence(initial_image_path, num_extensions, output_dir, date)