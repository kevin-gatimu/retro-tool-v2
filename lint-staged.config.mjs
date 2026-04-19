export default {
    'retro-tool-api/src/**/*.ts': [
        'pnpm --filter retro-tool-api lint',
        () => 'pnpm --filter retro-tool-api type-check',
    ],
    'retro-tool-api/test/**/*.ts': ['prettier --write'],
    'retro-tool-ui/src/**/*.{ts,tsx}': [
        'pnpm --filter retro-tool-ui lint',
        () => 'pnpm --filter retro-tool-ui type-check',
    ],
    'packages/shared/contracts/src/**/*.ts': [
        'pnpm --filter @retro-tool/contracts lint',
        () => 'pnpm --filter @retro-tool/contracts type-check',
    ],
    'convex-backend/**/*.ts': ['pnpm --filter convex-backend lint'],
}
