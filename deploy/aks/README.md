# AKS Deployment Scaffold

This directory contains the Kubernetes deployment scaffold for staging and production.

Structure:

- `base/` contains shared namespace and ingress resources.
- `overlays/staging/` contains staging-specific composition.
- `overlays/production/` contains production-specific composition.

The base resources assume:

- UI served behind `app.<env>.domain`
- NestJS API served behind `api.<env>.domain`
- Convex API served behind `convex-api.<env>.domain`
- Convex site/actions served behind `convex-site.<env>.domain`
- Convex dashboard served behind `convex-dashboard.<env>.domain`