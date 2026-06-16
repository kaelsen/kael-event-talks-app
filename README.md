# BigQuery Release Notes Radar 🚀

A modern web application built using Python Flask and plain vanilla HTML, CSS, and JavaScript that fetches the official Google Cloud BigQuery Release Notes RSS/Atom feed and allows you to browse, search, filter, and tweet about specific updates.

## Features

1. **Dashboard UI**: A premium dark-themed layout using modern glassmorphism design, ambient glow effects, responsive grid/flex layouts, and smooth animations.
2. **Dynamic Syncing**: 
   - A refresh button with a CSS-animated spinning status indicator.
   - Intelligent 5-minute caching mechanism to prevent excessive traffic to Google's servers, with an optional force-refresh bypass.
3. **Structured Timelines**: Grouped by date badges with visual indicators ("Today", "Yesterday", "X days ago").
4. **Category Tagging**: Updates are split by headings (e.g., `Feature`, `Issue`, `Deprecated`, `Changed`) and color-coded.
   - Green for **Features**
   - Rose Red for **Issues & Bugs**
   - Amber for **Deprecated**
   - Purple for **Changed / General**
5. **Interactive Controls**:
   - Client-side search across title text, update body content, or date.
   - Filter buttons with counts showing how many updates belong to each category.
6. **One-click Sharing (X/Twitter Integration)**:
   - Selecting any specific update opens a custom Tweet composer modal.
   - The composer automatically pre-populates a tweet template with a category emoji, date, parsed update snippet, direct anchor link to Google Cloud docs, and default hashtags.
   - Interactive SVG progress ring character counter (280 characters limit).
   - Clickable hashtag helper chips to quickly add relevant tags.
   - Launches X/Twitter's Web Intent composer in a new tab.

## File Structure

- [app.py](file:///D:/agy2-projects/agy-cli-projects/app.py) - Flask backend, RSS/Atom feed parser, caching logic, and API router.
- [templates/index.html](file:///D:/agy2-projects/agy-cli-projects/templates/index.html) - Application layout with modals, skeleton screens, and inline SVG icons.
- [static/css/style.css](file:///D:/agy2-projects/agy-cli-projects/static/css/style.css) - Premium CSS stylesheet containing variables, glassmorphism card styling, responsive layouts, and keyframes animations.
- [static/js/app.js](file:///D:/agy2-projects/agy-cli-projects/static/js/app.js) - App state controller, API fetch requests, timeline rendering, search/filtering, and modal interactive behavior.
- [requirements.txt](file:///D:/agy2-projects/agy-cli-projects/requirements.txt) - Python package requirements.

## How to Run

1. **Set up virtual environment (if not already done)**:
   ```bash
   py -m venv venv
   ```
2. **Activate the virtual environment**:
   - On Windows (PowerShell):
     ```powershell
     .\venv\Scripts\Activate.ps1
     ```
   - On Windows (CMD):
     ```cmd
     .\venv\Scripts\activate.bat
     ```
3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```
4. **Start the Flask Application**:
   ```bash
   python app.py
   ```
5. **Access the application**:
   Open your browser and navigate to: `http://127.0.0.1:5000`
