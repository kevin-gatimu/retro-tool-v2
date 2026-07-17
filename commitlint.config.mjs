export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // A parseable conventional-commit history is what release-please reads to
    // compute the next version — type and subject are therefore mandatory.
    'type-empty': [2, 'never'],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [0],
    'body-leading-blank': [1, 'always'],
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'perf',
        'test',
        'build',
        'ci',
        'chore',
        'revert',
      ],
    ],
    'subject-case': [2, 'never', ['start-case', 'pascal-case', 'upper-case']],
    'subject-max-length': [2, 'always', 100],
    'body-max-line-length': [2, 'always', 300],
    'header-max-length': [2, 'always', 100],
  },
};
