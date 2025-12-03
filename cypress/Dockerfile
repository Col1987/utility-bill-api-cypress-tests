# Use official Cypress image with Chrome + Node bundled
FROM cypress/included:13.15.0

# Create working directory inside the container
WORKDIR /e2e

# Copy package manifests first for better caching
COPY package*.json ./

# Install NPM dependencies (including Cypress tests & any libs you add)
RUN npm install

# Copy the rest of the project (cypress/, config, README, etc.)
COPY . .

# Default API base URL (can be overridden at runtime)
ENV CYPRESS_BASE_URL="https://api-t6vbon.bunnyenv.com"

# Run Cypress tests in headless mode when the container starts
CMD ["npx", "cypress", "run"]
