// Mock for @thallesp/nestjs-better-auth
export const AuthGuard = jest.fn().mockImplementation(() => {
  return { canActivate: () => true };
});

export const Roles = jest.fn().mockImplementation(() => {
  return () => {};
});

export const AllowAnonymous = jest.fn().mockImplementation(() => {
  return () => {};
});

export const Session = jest.fn().mockImplementation(() => {
  return () => {};
});
