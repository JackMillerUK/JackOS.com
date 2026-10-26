# JackOS Changelog

Official release history for JackOS.

This document records major features, improvements, security updates, bug fixes, and milestones across publicly available JackOS releases.

---

## Testing Older Versions

Users running **JackOS Pro** or **JackOS Elite** on **JackOS v5 Beta 1 or later** can test previous versions of JackOS using the **JackOS Sandbox Emulator**.

The Sandbox Emulator allows older JackOS releases to be launched within an isolated environment without affecting the host operating system or its data. This is useful for:

- Viewing historical releases.
- Testing compatibility.
- Exploring legacy features.
- Demonstrating the evolution of JackOS.
- Debugging version-specific issues.

Unless otherwise noted, all archived releases listed in this changelog can be launched through the Sandbox Emulator when available within the installed JackOS version.

---

## JackOS v4.2.1

**Release Date:** 15th May 2026

### Overview

JackOS v4.2.1 is a security-focused maintenance release designed to strengthen account protection and improve overall system reliability.

### Changes

#### Security Improvements

- Administrator authentication is now required before security questions can be modified.
- Additional validation checks have been added to sensitive account-management actions.
- Security hardening improvements help protect important account recovery settings.

#### Bug Fixes

- Fixed minor issues affecting account configuration.
- Resolved several small security-related bugs.
- Improved overall system stability.

---

## JackOS v4.2

**Release Date:** 9th May 2026

### Overview

JackOS v4.2 introduced one of the largest data-management updates in JackOS history. This release added comprehensive backup and recovery tools for user data, system settings, photos, and JackOSDrive contents.

### New Features

#### System Backup and Restore

Located in:

`Settings → Data → System`

Users can now export and import system backups using the new `.jkb` backup format.

System backups include:

- User accounts
- Password information
- Wallpapers
- System configuration
- Version information

##### Exporting

To create a backup:

1. Authenticate using the administrator username and password.
2. Choose a backup password.
3. Save the generated `.jkb` file.

##### Importing

To restore a backup:

1. Authenticate using the administrator username and password.
2. Select the `.jkb` file.
3. Enter the backup password that was used during creation.

#### Enhanced Backup Security

The backup system was designed with multiple layers of protection:

- Administrator authentication is required.
- Backup files are password protected.
- Authentication is required again during restoration.
- Unauthorized users cannot easily access exported backup data.

#### Photo Backup and Restore

Located in:

`Settings → Data → Photos`

Users can:

- Export photo libraries.
- Import previously exported photo collections.

All actions require administrator authentication.

#### JackOSDrive Backup and Restore

Located in:

`Settings → Data → JackOSDrive`

Users can:

- Export drive contents into a ZIP archive.
- Import ZIP archives into JackOSDrive.

Imported files are added to existing storage rather than replacing all contents.

### Compatibility Notes

- Backup functionality requires JackOS v4.2 or later.
- Backup files should be restored using the same JackOS version that created them.
- Version mismatch errors may occur if incompatible backups are loaded.

### Additional Improvements

- Improved system data handling.
- Better recovery workflows.
- More reliable import and export operations.

---

## JackOS v4.1.1

**Release Date:** 7th May 2026

### Overview

JackOS v4.1.1 focused on stability, reliability, and user-interface improvements following feedback from earlier releases.

### Improvements

#### Browser

- Fixed multiple browser-related issues.
- Improved webpage rendering reliability.
- Increased application stability.

#### Photos

- Resolved issues affecting the Photos application.
- Improved image loading behaviour.
- Fixed several file-management problems.

#### JCAM

- Addressed remaining camera-related issues.
- Improved application startup reliability.
- Enhanced stability during use.

#### User Interface

- Fixed broken interface elements.
- Corrected visual inconsistencies.
- Improved overall system appearance and usability.

#### System Changes

- Renamed and reorganised internal system files.
- Improved system structure for future development.

---

## JackOS v4.1

**Release Date:** 7th May 2026

### Overview

This update delivered an emergency fix for JCAM while larger user-interface improvements continued in development.

### Fixes

#### JCAM

- Fixed the primary issue preventing normal operation.
- Improved application stability.
- Restored full application functionality.

### Notes

- Planned interface updates were delayed to the following release.
- Development efforts were prioritised on resolving the JCAM issue.

---

## JackOS v4.0

**Release Date:** 30th April 2026

### Overview

JackOS v4.0 marked a major security milestone and introduced stronger administrative controls across the operating system.

### Security Improvements

#### Administrative Authentication

Administrator verification is now required for many sensitive actions throughout the system.

Benefits include:

- Improved protection against unauthorised changes.
- Better safeguarding of user data.
- More secure account-management workflows.

#### Security Question System

- Fixed vulnerabilities affecting security questions.
- Improved account recovery security.
- Enhanced verification processes.

#### Additional Security Hardening

- General security improvements throughout the operating system.
- Better protection for system settings and sensitive information.

---

# Legacy Releases

The following releases are preserved for historical and compatibility purposes.

---

## JackOS v3.2

**Release Date:** Unknown

### Overview

A maintenance release that contributed to the foundation of future JackOS development.

### Known Information

- Incremental improvements and refinements.
- Internal changes preparing for future releases.

---

## JackOS v3.1.8

**Release Date:** Unknown

### Overview

One of the most visually significant updates released during the JackOS v3 lifecycle.

### Major Changes

#### User Interface Refresh

- Introduced a substantially redesigned interface.
- Modernised the desktop experience.
- Improved visual consistency throughout the operating system.
