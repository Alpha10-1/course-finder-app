// Small row of social icon links. Used at the bottom of the Home screen,
// under the Sign Out button.
//
// TODO: replace these with your real profile/page URLs.
const LINKS = {
  facebook: "https://www.facebook.com/profile.php?id=61591804287860",
//   twitter: "https://x.com/",
  instagram: "https://www.instagram.com/course_finder_sa/?hl=en",
};

const ICONS = {
  facebook: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5 3.66 9.15 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.51 1.49-3.9 3.77-3.9 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.44 2.91h-2.34V22c4.78-.79 8.44-4.94 8.44-9.94Z" />
    </svg>
  ),
//   twitter: (
//     <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
//       <path d="M18.9 2H22l-7.19 8.21L23.3 22h-6.62l-5.18-6.77L5.5 22H2.37l7.7-8.8L1 2h6.79l4.68 6.19L18.9 2Zm-1.16 18h1.73L7.35 3.9H5.49L17.74 20Z" />
//     </svg>
//   ),
  instagram: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
      <path d="M12 2c2.72 0 3.06.01 4.12.06 1.06.05 1.79.22 2.43.47.66.26 1.21.6 1.76 1.15.5.5.85 1.02 1.15 1.76.25.64.42 1.37.47 2.43C21.99 8.94 22 9.28 22 12s-.01 3.06-.06 4.12c-.05 1.06-.22 1.79-.47 2.43a4.9 4.9 0 0 1-1.15 1.76 4.9 4.9 0 0 1-1.76 1.15c-.64.25-1.37.42-2.43.47C15.06 21.99 14.72 22 12 22s-3.06-.01-4.12-.06c-1.06-.05-1.79-.22-2.43-.47a4.9 4.9 0 0 1-1.76-1.15 4.9 4.9 0 0 1-1.15-1.76c-.25-.64-.42-1.37-.47-2.43C2.01 15.06 2 14.72 2 12s.01-3.06.06-4.12c.05-1.06.22-1.79.47-2.43.26-.66.6-1.21 1.15-1.76.5-.5 1.02-.85 1.76-1.15.64-.25 1.37-.42 2.43-.47C8.94 2.01 9.28 2 12 2Zm0 1.8c-2.67 0-2.99.01-4.04.06-.92.04-1.42.19-1.75.32-.44.17-.75.38-1.08.71-.33.33-.54.64-.71 1.08-.13.33-.28.83-.32 1.75C4.05 8.87 4.04 9.2 4.04 12s.01 2.99.06 4.04c.04.92.19 1.42.32 1.75.17.44.38.75.71 1.08.33.33.64.54 1.08.71.33.13.83.28 1.75.32 1.05.05 1.37.06 4.04.06s2.99-.01 4.04-.06c.92-.04 1.42-.19 1.75-.32.44-.17.75-.38 1.08-.71.33-.33.54-.64.71-1.08.13-.33.28-.83.32-1.75.05-1.05.06-1.37.06-4.04s-.01-2.99-.06-4.04c-.04-.92-.19-1.42-.32-1.75a2.9 2.9 0 0 0-.71-1.08 2.9 2.9 0 0 0-1.08-.71c-.33-.13-.83-.28-1.75-.32C14.99 3.81 14.67 3.8 12 3.8Zm0 3.05a5.15 5.15 0 1 1 0 10.3 5.15 5.15 0 0 1 0-10.3Zm0 1.8a3.35 3.35 0 1 0 0 6.7 3.35 3.35 0 0 0 0-6.7Zm5.35-1.98a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0Z" />
    </svg>
  ),
};

export default function SocialLinks({ className = "" }) {
  return (
    <div className={`flex items-center gap-4 ${className}`}>
      {Object.entries(LINKS).map(([name, url]) => (
        <a
          key={name}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Follow us on ${name[0].toUpperCase()}${name.slice(1)}`}
          title={`${name[0].toUpperCase()}${name.slice(1)}`}
          className="text-gray-400 hover:text-purple-600 transition-colors"
        >
          {ICONS[name]}
        </a>
      ))}
    </div>
  );
}