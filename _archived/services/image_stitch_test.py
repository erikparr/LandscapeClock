import os
from PIL import Image
import sys
from datetime import datetime, timedelta

def create_seed_image_for_next_day(date_str, input_dir, output_base_dir):
    # Parse the input date
    current_date = datetime.strptime(date_str, '%Y-%m-%d')
    
    # Calculate the next day's date
    next_day = current_date + timedelta(days=1)
    next_day_str = next_day.strftime('%Y-%m-%d')

    # Path for the current day's full landscape image
    full_day_path = os.path.join(input_dir, f"{date_str}_full_day_landscape.png")

    if not os.path.exists(full_day_path):
        print(f"Error: Full day landscape not found at {full_day_path}")
        return

    # Create the output directory for the next day
    next_day_dir = os.path.join(output_base_dir, next_day_str)
    os.makedirs(next_day_dir, exist_ok=True)

    # Path for the next day's seed image
    seed_image_path = os.path.join(next_day_dir, 'default_seed_image.png')

    # Open the full day landscape and crop the rightmost 512x512 pixels
    with Image.open(full_day_path) as img:
        width, height = img.size
        if width < 512 or height < 512:
            print(f"Error: Full day landscape is smaller than 512x512 pixels")
            return
        
        seed_image = img.crop((width - 512, 0, width, 512))
        seed_image.save(seed_image_path)

    print(f"Seed image for {next_day_str} created and saved to: {seed_image_path}")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python test_seed_image_creation.py <YYYY-MM-DD>")
        sys.exit(1)

    date_str = sys.argv[1]
    try:
        datetime.strptime(date_str, '%Y-%m-%d')
    except ValueError:
        print("Invalid date format. Please use YYYY-MM-DD")
        sys.exit(1)

    # Assuming the script is run from the project root
    base_path = os.path.join('static', 'images')
    input_dir = os.path.join(base_path, date_str)
    output_base_dir = base_path

    create_seed_image_for_next_day(date_str, input_dir, output_base_dir)