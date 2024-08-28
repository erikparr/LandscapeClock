import sys
from services.image_extender import ImageExtender

def main():
    last_image_path = 'static/images/default_seed_image.png'
    prompts = ['Test landscape']
    output_dir = 'static/images'

    extender = ImageExtender()
    new_paths = extender.generate_daily_sequence(last_image_path, len(prompts), prompts, output_dir)
    print(f"Generated images: {new_paths}")

if __name__ == "__main__":
    main()