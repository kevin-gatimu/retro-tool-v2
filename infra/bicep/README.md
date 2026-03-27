# Azure Bicep Scaffold

This directory contains the Azure infrastructure scaffold for the Retro Tool platform.

Environment entry points live under `environments/` and call reusable modules from `modules/`.

Intended target architecture:

- AKS for application runtime
- ACR for container images
- Azure Database for PostgreSQL Flexible Server
- Key Vault for secrets
- Log Analytics and Application Insights for observability
- Private networking for production hardening

These files are intentionally minimal scaffolds and should be expanded before first deployment.