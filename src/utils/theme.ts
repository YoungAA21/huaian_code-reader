export const getPreferredTheme = () => {
  const savedTheme = localStorage.getItem('theme')
  if (savedTheme === 'dark' || savedTheme === 'light') {
    return savedTheme
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export const applyTheme = (theme: 'dark' | 'light') => {
  document.documentElement.classList.toggle('dark-theme', theme === 'dark')
  document.documentElement.style.colorScheme = theme
  localStorage.setItem('theme', theme)
}

export const initializeTheme = () => {
  const theme = getPreferredTheme()
  applyTheme(theme)
  return theme
}
