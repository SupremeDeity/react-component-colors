# React Component Color [INDEV]

React Component Color adds color to your React Components to help you differentiate between client and server components more easily.

> Currently only meant with NextJS due it currently being the only major framework implementing RSC.

> WARNING: This extension is very early in its development period and may behave weirldy.

<img src="./assets/ReactComponentColors.png" />
<img src="./assets/ReactComponentColors2.png" />

## Extension Settings

This extension contributes the following settings:

- `reactColorComponents.clientBackground`: Background color for client components. Must be a valid hex-color.
- `reactColorComponents.clientForeground`: Foreground color for client components. Must be a valid hex-color.
- `reactColorComponents.serverBackground`: Background color for server components. Must be a valid hex-color.
- `reactColorComponents.serverForeground`: Foreground color for server components. Must be a valid hex-color.

## Known Issues

1. Incorrect results may be shown on first load, make a small change to the document to fix this. This might be fixed in a future release.
2. Dynamic imports & require statements do not work for now as they have not been implemented. Support will be added in a future release.

## Release Notes

### 0.1.0

Initial release of React Component Color

### 0.1.1

refactor: Complete refactoring to provide more accurate results.

### 0.1.2

refactor: Further refactoring to fix a bug where importing and exporting from the same file doesn't work
refactor: Abstracted code into multiple files.
docs: fixed docs to contain updated info.

### 0.1.3

refactor: Remove unnecessary tests and license file.
docs: update docs and add preview images.
