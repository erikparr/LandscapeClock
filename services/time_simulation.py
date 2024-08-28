import time
from datetime import datetime, timedelta
import requests
import os
import shutil
import argparse

class TimeSimulator:
    def __init__(self, start_date=None, start_time=None, acceleration_factor=3600, app_url='http://localhost:3000'):
        if start_date is None:
            start_date = datetime.now().strftime('%Y-%m-%d')
        if start_time is None:
            start_time = datetime.now().strftime('%H:%M:%S')
        
        self.current_time = datetime.strptime(f"{start_date} {start_time}", "%Y-%m-%d %H:%M:%S")
        self.acceleration_factor = acceleration_factor
        self.base_image_path = os.path.join('static', 'images', '2024-08-26')
        self.simulation_image_path = os.path.join('static', 'images', 'simulation')
        self.app_url = app_url

    def advance_time(self, seconds):
        self.current_time += timedelta(seconds=seconds)
        return self.current_time

    def copy_image_set(self, date):
        target_dir = os.path.join(self.simulation_image_path, date)
        if not os.path.exists(target_dir):
            shutil.copytree(self.base_image_path, target_dir)
            # Rename files to match the simulated date
            for filename in os.listdir(target_dir):
                if filename.startswith('2024-08-26'):
                    new_filename = filename.replace('2024-08-26', date)
                    os.rename(os.path.join(target_dir, filename), os.path.join(target_dir, new_filename))

    def trigger_app_events(self):
        try:
            simulation_time = self.current_time.isoformat()
            print(f"Sending simulated time: {simulation_time}")  # Add this line
            response = requests.get(f'{self.app_url}/api/current-landscape', 
                                    params={'simulation_time': simulation_time},
                                    timeout=1)
            print(f"API response: {response.status_code}")
            print(f"API response content: {response.text}")  # Add this line
        except requests.exceptions.RequestException as e:
            print(f"Error connecting to the application: {e}")

    def run_simulation(self, duration_hours):
        end_time = self.current_time + timedelta(hours=duration_hours)
        while self.current_time < end_time:
            print(f"Simulated time: {self.current_time}")
            
            # Copy image set for the current day if it doesn't exist
            current_date = self.current_time.strftime("%Y-%m-%d")
            self.copy_image_set(current_date)
            
            # Trigger app events
            self.trigger_app_events()
            
            # Advance time by 1 minute (simulated)
            self.advance_time(60)
            
            # Wait for a short time (real time)
            time.sleep(1 / self.acceleration_factor)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run a time simulation for the Landscape Clock application.")
    parser.add_argument('--start-date', help='Start date for the simulation (YYYY-MM-DD). Defaults to today.')
    parser.add_argument('--start-time', help='Start time for the simulation (HH:MM:SS). Defaults to current time.')
    parser.add_argument('--duration', type=int, default=48, help='Duration of the simulation in hours')
    parser.add_argument('--acceleration', type=int, default=360, help='Acceleration factor (default: 360, 1 real second = 1 hour)')
    parser.add_argument('--app-url', default='http://localhost:3000', help='URL of the Nuxt.js application')

    args = parser.parse_args()

    simulator = TimeSimulator(args.start_date, args.start_time, acceleration_factor=args.acceleration, app_url=args.app_url)
    simulator.run_simulation(args.duration)