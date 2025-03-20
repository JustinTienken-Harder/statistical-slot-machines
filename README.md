# Statistical Slot Machines

This project is a web-based application that allows users to explore statistical distributions through interactive slot machines. Users can select a distribution type, set parameters, and see how their choices affect payouts compared to an optimal strategy.

## Features

- Select a number between 2-8 to determine the number of slot machines.
- Choose from several premade statistical distributions (normal, uniform, chi-squared, etc.) and set their parameters.
- Interactive slot machines that simulate payouts based on the selected distributions.
- A chart that tracks total payouts from the machines against the optimal strategy.
- Custom sampling methods for slot machines that can also be graphed.

## Project Structure

- `index.html`: Main HTML file for the application.
- `css/styles.css`: Styles for a clean and visually appealing layout.
- `js/app.js`: Initializes the application and handles user interactions.
- `js/distributions.js`: Functions to create and manage statistical distributions.
- `js/slotMachine.js`: Logic for the slot machines, including spinning and payout calculations.
- `js/chart.js`: Renders the payout chart using a charting library.
- `js/optimalStrategy.js`: Implements the logic for determining the optimal strategy.
- `lib/chart.min.js`: Minified charting library for rendering charts.
- `lib/d3.min.js`: Minified D3.js library for data visualization.
- `assets/favicon.svg`: Favicon for the website.

## Usage

1. Clone the repository to your local machine.
2. Open `index.html` in your web browser.
3. Select the desired number of slot machines and distribution parameters.
4. Click on the slot machines to see the payouts and track your performance.

## License

This project is open-source and available for modification and distribution. Please refer to the license file for more details.