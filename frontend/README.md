# ASK KRISHNA Frontend

This is the React frontend for the ASK KRISHNA application, a conversational AI assistant that helps users explore the teachings of the Bhagavad Gita.

## Features

- Modern, responsive UI inspired by GitaGPT
- Multilingual support (English and Hindi)
- User authentication (login/register)
- Chat history for logged-in users
- Question limit (30 questions) for non-logged-in users
- Clear chat functionality

## Tech Stack

- React.js
- React Router for navigation
- Context API for state management
- Axios for API requests
- React Icons for UI icons
- React Markdown for rendering markdown responses

## Project Structure

```
├── public/                 # Static files
├── src/
│   ├── components/         # Reusable UI components
│   │   ├── Footer/
│   │   ├── Header/
│   │   └── PrivateRoute/
│   ├── contexts/           # React contexts
│   │   └── AuthContext.js  # Authentication context
│   ├── pages/              # Page components
│   │   ├── Auth/           # Login and Register pages
│   │   ├── Chat/           # Main chat interface
│   │   ├── History/        # Chat history page
│   │   └── Home/           # Landing page
│   ├── services/           # API services
│   │   └── api.js          # API client
│   ├── App.js              # Main App component
│   ├── App.css             # App styles
│   ├── index.js            # Entry point
│   └── index.css           # Global styles
└── package.json            # Dependencies and scripts
```

## Getting Started

### Prerequisites

- Node.js (v14 or later)
- npm or yarn

### Installation

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

3. Start the development server:
   ```bash
   npm start
   # or
   yarn start
   ```

4. The app will be available at http://localhost:3000

## Integration with Backend

The frontend is designed to work with the Streamlit backend through a Flask API bridge. The backend integration is handled in the `backend_integration.py` file at the root of the project.

To run the complete application:

1. Install the required Python packages:
   ```bash
   pip install flask flask-cors
   ```

2. Run the backend integration script:
   ```bash
   python backend_integration.py
   ```

3. This will start both the Streamlit app and the Flask API server.

4. Start the React frontend as described above.

## Building for Production

To create a production build:

```bash
npm run build
# or
yarn build
```

The build artifacts will be stored in the `build/` directory.

## Customization

- Colors and theme variables can be modified in `src/index.css`
- To change the logo, replace the SVG files in the `public/` directory