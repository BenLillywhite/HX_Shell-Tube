#!/bin/bash

# Get directory of the script to ensure paths are resolved correctly
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

# Check if .venv directory exists
if [ ! -d ".venv" ]; then
    echo "Error: Virtual environment (.venv) not found."
    echo "Please set up the virtual environment first."
    exit 1
fi

# Activate virtual environment
source .venv/bin/activate

# Check if Django is installed
if ! python -c "import django" &> /dev/null; then
    echo "Error: Django is not installed in the virtual environment."
    echo "Running pip install django..."
    pip install django
fi

# Start Django development server
echo "Starting Django development server..."
echo "Open your browser and navigate to: http://127.0.0.1:8000/"
python manage.py runserver
