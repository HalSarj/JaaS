// Static user ID authentication for single-user deployment
export const getCurrentUser = () => {
  const userId = process.env.NEXT_PUBLIC_USER_ID || null
  
  return {
    id: userId === 'null' || !userId ? null : userId,
    // Could add more user properties here if needed in the future
  }
}

// Utility to get current user ID directly
export const getCurrentUserId = () => getCurrentUser().id