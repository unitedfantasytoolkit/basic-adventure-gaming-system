# Contributing to the Basic Adventure Gaming System

Thank you for your interest in contributing to our Foundry VTT system! This guide will help you get started, even if you're new to Foundry development.

## Getting Started

### What You'll Need

- [Git](https://git-scm.com/downloads) for managing code changes
- [Node.js](https://nodejs.org/) (version 18 or newer) for running development tools
- A code editor like [Visual Studio Code](https://code.visualstudio.com/)
- A [Foundry VTT](https://foundryvtt.com/) license (for testing)

### Setting Up Your Development Environment

1. **Fork the repository** by clicking the "Fork" button at the top of the GitHub page.

2. **Clone your fork** to your computer:

   ```sh
   git clone https://github.com/YOUR-USERNAME/basic-adventure-gaming-system.git
   cd basic-adventure-gaming-system
   ```

3. **Install dependencies**:

   ```sh
   npm install
   ```

4. **Start the development server**:

   ```sh
   npm start
   ```

   This will automatically build the code whenever you make changes.

5. **Link to Foundry**: Create a symbolic link from your Foundry systems folder to your development folder. This lets you test your changes in Foundry.

   On Windows (run as administrator):

   ```sh
   mklink /D "C:\path\to\foundry\Data\systems\bags" "C:\path\to\your\basic-adventure-gaming-system"
   ```

   On Mac/Linux:

   ```sh
   ln -s /path/to/your/basic-adventure-gaming-system /path/to/foundry/Data/systems/bags
   ```

## Project Structure

Here's a simple breakdown of our folders:

- `src/` - All the source code
  - `actors/` - Character sheets and actor-related code
  - `items/` - Item sheets and item-related code
  - `combat/` - Combat tracker and initiative systems
  - `components/` - Custom UI elements
  - `utils/` - Helper functions

## Making Changes

### Creating a New Feature

1. **Create a new branch** for your feature:

   ```sh
   git checkout -b my-new-feature
   ```

2. **Make your changes** to the code.

3. **Test your changes** in Foundry VTT.

4. **Commit your changes**:

   ```sh
   git add .
   git commit -m "Add a helpful description of your changes"
   ```

5. **Push to your fork**:

   ```sh
   git push origin my-new-feature
   ```

6. **Create a Pull Request** on GitHub.

### Coding Guidelines

- Use clear variable and function names
- Add comments to explain complex code
- Follow the existing code style
- Test your changes before submitting

## Common Tasks

### Adding a New Component

Components are custom HTML elements that make up the user interface. They live in `src/components/`.

To create a new component:

1. Create a new file in `src/components/` named `component.your-component-name.mjs`
2. Use this template:

   ```js
   import { component } from "./component.utils.decorators.mjs"
   import BaseElement from "./component.utils.base-component.mjs"

   @component("bags-your-component-name")
   export default class YourComponentName extends BaseElement {
     // Add your component code here

     // This runs when the component is created
     async prepareData() {
       // Initialize your component
     }

     // This sets up event listeners
     events() {
       // Add event listeners
     }
   }
   ```

### Fixing a Bug

1. Find the file with the bug
2. Make your fix
3. Test it thoroughly
4. Submit a pull request with a clear description of the bug and how you fixed it

## Getting Help

If you're stuck or have questions:

- Check the existing documentation
- Look at similar code in the project
- Ask for help in the pull request, issues section, or on [our Discord server](https://discord.gg/HQXG7dP8gf)

We welcome contributors of all experience levels! Don't be afraid to ask questions or make mistakes.

## Thank You

Every contribution helps make this system better. We appreciate your time and effort!
