# FlashForge API Documentation

Welcome to the Unofficial FlashForge API Documentation! This is a community-driven effort to document the various APIs used by FlashForge 3D printers.

FlashForge printers primarily utilize two distinct types of APIs:

*   A **"Legacy" TCP-based API**: Common in older models and still present in newer ones.
*   A newer **HTTP-based API**: Introduced with more recent printer series, offering a more modern interface.

This documentation is compiled from observing network traffic, analyzing publicly available source code, and community testing.

## "Legacy" TCP API

Used by older FlashForge printer models and still available on newer models for specific functionalities or backward compatibility. This API generally involves sending specific text-based commands over a TCP connection.

More details can be found in the [Legacy TCP API Documentation](legacy-api.md).

## HTTP API

Introduced with newer models like the Adventurer 5 Series, offering a more modern, feature-rich interface. This API typically uses standard HTTP methods (GET, POST, etc.) and JSON for data exchange.

More details can be found in the [HTTP API Documentation](http-api.md).

## Contributing

Here are some ways you can contribute:

*   **Verify Information:** Test commands and endpoints against different FlashForge printer models and report your findings.
*   **Add Missing Content:** If you've discovered undocumented endpoints, commands, or parameters, please share them.
*   **Correct Inaccuracies:** Help us fix any errors or outdated information.

