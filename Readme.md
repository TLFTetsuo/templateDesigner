# Template Designer App

## Overview
The Template Designer App is a web application that allows users to create and edit templates for an image generator. The output of the application is YAML files specifically designed for electronic shelf labels.

## Features
- **Template Creation**: Users can create and edit templates using a user-friendly interface.
- **Live Preview**: A real-time preview of the template being designed is available.
- **YAML Export**: Designed templates can be exported as YAML files for easy integration with electronic shelf labels.
- **Validation**: The application includes validation to ensure that the templates meet required specifications.

## Project Structure
```
template-designer-app
├── src
│   ├── components
│   │   ├── TemplateEditor.tsx
│   │   ├── PreviewPanel.tsx
│   │   └── YamlExporter.tsx
│   ├── pages
│   │   ├── index.tsx
│   │   └── editor.tsx
│   ├── utils
│   │   ├── yamlGenerator.ts
│   │   └── templateValidator.ts
│   ├── types
│   │   └── index.ts
│   └── styles
│       └── globals.css
├── public
│   └── templates
│       └── sample-template.yaml
├── package.json
├── tsconfig.json
├── next.config.js
└── README.md
```

## Installation
1. Clone the repository:
   ```
   git clone <repository-url>
   ```
2. Navigate to the project directory:
   ```
   cd template-designer-app
   ```
3. Install the dependencies:
   ```
   npm install
   ```

## Usage
To start the development server, run:
```
npm run dev
```
Open your browser and navigate to `http://localhost:3000` to access the application.

## Contributing
Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License
This project is licensed under the MIT License. See the LICENSE file for details.