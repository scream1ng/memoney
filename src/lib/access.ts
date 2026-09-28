export const isAdmin = (user: { email: string; emailVerified: boolean } | undefined) =>
  !!user?.emailVerified && user.email.toLowerCase() === 'imbaoak@gmail.com'
