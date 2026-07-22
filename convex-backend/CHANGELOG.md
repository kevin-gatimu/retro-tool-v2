# Changelog

## [1.1.0](https://github.com/kevin-gatimu/retro-tool-v2/compare/convex-backend-v1.0.0...convex-backend-v1.1.0) (2026-07-22)


### Features

* add additional dependencies for rate limiting and aggregation ([7ae2d38](https://github.com/kevin-gatimu/retro-tool-v2/commit/7ae2d38a6c369157a108735b2d707ec4a0dbc861))
* Add Azure deployment configuration and workflows ([76c209e](https://github.com/kevin-gatimu/retro-tool-v2/commit/76c209ed293517705240c9714e475110cc3c616d))
* add Convex admin management features ([f259891](https://github.com/kevin-gatimu/retro-tool-v2/commit/f259891158c161150844bf0c61524262fd66a413))
* add Convex components for rate limiting and aggregation ([ea1259e](https://github.com/kevin-gatimu/retro-tool-v2/commit/ea1259e41df3326e3a433ec73b1831b7582dcaa6))
* Add Convex database management and environment setup scripts ([df18fcb](https://github.com/kevin-gatimu/retro-tool-v2/commit/df18fcbf8aba5ab2fca0da2232ba8bfa03512b0d))
* add database backup script and update package.json scripts ([6adb9e0](https://github.com/kevin-gatimu/retro-tool-v2/commit/6adb9e0f7db790a18a5d289e909c43ad7e6119b6))
* add icebreaker session management and UI components ([91e65ee](https://github.com/kevin-gatimu/retro-tool-v2/commit/91e65ee49127b8252119b04b5fa98863693d160f))
* add standup features including reaction bar, submission dialog, and convex sync ([5e62627](https://github.com/kevin-gatimu/retro-tool-v2/commit/5e62627edea78378d0c97a8c625dfe5e75a18dad))
* add weekly digest feature with CRUD operations and email notifications ([0f0e0d2](https://github.com/kevin-gatimu/retro-tool-v2/commit/0f0e0d2de3c00dd5266725d9b85be851dbe63c36))
* **convex-admin:** add missing tables to admin clear/schedule UI ([b687251](https://github.com/kevin-gatimu/retro-tool-v2/commit/b6872516eeaf6e4f5a343cb3c642630720f54d2f))
* **convex-admin:** transactional projection outbox + full reconciliation ([5a8912c](https://github.com/kevin-gatimu/retro-tool-v2/commit/5a8912c6d69ea6b1345d9929671f9f8f26c2c285))
* **deploy:** add self-hosted Convex production infra and fix env picker ([0075e53](https://github.com/kevin-gatimu/retro-tool-v2/commit/0075e53b28d9432186190036a6ce9d65448e3eda))
* enhance retro discussion view and sync components ([b841e04](https://github.com/kevin-gatimu/retro-tool-v2/commit/b841e041eb1c6a4bd3bc52df6bcdf999cdd5f4bc))
* **icebreakers:** broadcast reactions to all + stop persisting sessions ([8d96471](https://github.com/kevin-gatimu/retro-tool-v2/commit/8d964716e35d7faa4a9a71c5112d13dbe42f4d0f))
* implement drag-and-drop functionality for standup questions and add survey detail and index pages ([7156064](https://github.com/kevin-gatimu/retro-tool-v2/commit/71560641d142c7967baf092004600e11bc6df06f))
* implement real-time notifications sync with Convex ([f69ce6c](https://github.com/kevin-gatimu/retro-tool-v2/commit/f69ce6cd88c700c97c2671aad618dc0efc8f885d))
* implement WebSocket authentication via Better Auth ([544e754](https://github.com/kevin-gatimu/retro-tool-v2/commit/544e754cd0d166cc5abf5f718f12b791458df149))
* **infra:** self-host Convex on Azure App Service for staging ([379edc5](https://github.com/kevin-gatimu/retro-tool-v2/commit/379edc56e155913fa1276108505653e65123582a))
* reports dashboards overhaul, guidelines-compliance refactor ([8f1ca8f](https://github.com/kevin-gatimu/retro-tool-v2/commit/8f1ca8f21f96c38cb41067bc51e02bb834cc475f))
* update ai-files and guidelines with new hashes and skill paths for improved functionality ([ad24efa](https://github.com/kevin-gatimu/retro-tool-v2/commit/ad24efa67d664537db15aeca148d9531fec558bc))


### Bug Fixes

* **convex:** eliminate OCC write conflicts on concurrent projection writes ([a380b5f](https://github.com/kevin-gatimu/retro-tool-v2/commit/a380b5fcbc90f378866149202f660595f57fbd93))
* **estimates:** live participant presence via direct Convex path ([b1b23b5](https://github.com/kevin-gatimu/retro-tool-v2/commit/b1b23b5fa0966d3c34fe4cbd22faa8a8cca8d6d3))
* **icebreakers:** don't throw on reactions query for an ended session ([5e2b428](https://github.com/kevin-gatimu/retro-tool-v2/commit/5e2b4287c6151b42756a6ed9011a6865c36e7a0d))
* update health check to include database connectivity status ([6adb9e0](https://github.com/kevin-gatimu/retro-tool-v2/commit/6adb9e0f7db790a18a5d289e909c43ad7e6119b6))
