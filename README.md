# FlashForge API Documentation

Welcome to the Unofficial FlashForge API Documentation! This is a community-driven effort to document the various APIs used by FlashForge 3D printers. Our goal is to provide a comprehensive resource for developers and enthusiasts looking to interact with their printers programmatically.

FlashForge printers primarily utilize two distinct types of APIs:

*   A **"Legacy" TCP-based API**: Common in older models and still present in some newer ones.
*   A newer **HTTP-based API**: Introduced with more recent printer series, offering a more modern interface.

This documentation is compiled from observing network traffic, analyzing publicly available source code, and community testing.

## "Legacy" TCP API

Used by older FlashForge printer models and still available on some newer models for specific functionalities or backward compatibility. This API generally involves sending specific text-based commands over a TCP connection.

More details can be found in the [Legacy TCP API Documentation](legacy-api.md).

## HTTP API

Introduced with newer models like the Adventurer 5 Series, offering a more modern, feature-rich interface. This API typically uses standard HTTP methods (GET, POST, etc.) and JSON for data exchange.

More details can be found in the [HTTP API Documentation](http-api.md).

## Contributing

We welcome and encourage community contributions to improve and expand this documentation! Your help is invaluable in keeping this resource accurate and up-to-date.

Here are some ways you can contribute:

*   **Verify Information:** Test commands and endpoints against different FlashForge printer models and report your findings.
*   **Add Missing Content:** If you've discovered undocumented endpoints, commands, or parameters, please share them.
*   **Correct Inaccuracies:** Help us fix any errors or outdated information.
*   **Improve Clarity and Examples:** Enhance the existing documentation by making it clearer, providing better examples, or adding more detailed explanations.

Contributions can be made via:

*   **Pull Requests:** If you're comfortable with Git and Markdown, feel free to submit pull requests with your proposed changes.
*   **Raising Issues:** If you find an error, have a suggestion, or want to discuss a potential addition, please open an issue in the repository.

Thank you for helping make this documentation better!
