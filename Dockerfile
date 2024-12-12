# Use an official Node.js runtime as a parent image
FROM node:16

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Install global Nest CLI (to ensure proper Nest commands can run)
RUN npm install -g @nestjs/cli

# Copy the rest of the application code
COPY . .

# Ensure permissions for running scripts inside the container
RUN chmod -R 777 /usr/src/app

# Build the application
RUN npm run build

# Expose the application port
EXPOSE 3000

# Command to run the application
CMD ["npm", "run", "start:prod"]
