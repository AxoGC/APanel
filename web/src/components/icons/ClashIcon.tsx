import { useId } from 'react'

// Clash's cat mascot, redrawn as a two-tone icon: the face is a solid
// currentColor fill (the two mirrored outline paths auto-close into left/
// right face halves along the vertical seam down their shared center
// point, so together they paint the whole silhouette), with the eyes and
// mouth punched out as transparent holes via an SVG mask rather than
// painted in a fixed color — so they read correctly against any
// background/theme. The paw flourish sits outside the face fill already,
// so it stays a plain currentColor stroke on top.
export function ClashIcon({ className }: { className?: string }) {
  const maskId = useId()

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className={className}>
      <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="48" height="48">
        <rect width="48" height="48" fill="#fff" />
        <ellipse cx="21.24" cy="20.309" rx="1.671" ry="2.13" fill="#000" />
        <ellipse cx="33.14" cy="20.309" rx="1.671" ry="2.13" fill="#000" />
        <path
          fill="none"
          stroke="#000"
          strokeWidth="1.6"
          strokeLinecap="round"
          d="M25.463 26.387a1.467 1.467 0 0 0 1.473-1.472"
        />
        <path
          fill="none"
          stroke="#000"
          strokeWidth="1.6"
          strokeLinecap="round"
          d="M28.41 26.387a1.467 1.467 0 0 1-1.474-1.472"
        />
      </mask>

      <path
        fill="currentColor"
        mask={`url(#${maskId})`}
        d="M27.19 42.5a89 89 0 0 1-14.681-1.572S13.94 12.372 17.92 5.535c-.13-.297 2.992 1.212 4.422 6.266a25.6 25.6 0 0 1 4.847-.47M27.19 42.5a89 89 0 0 0 14.681-1.572S40.44 12.372 36.458 5.535c.03-.2-3.59 1.755-4.421 6.266a25.6 25.6 0 0 0-4.848-.47"
      />

      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12.508 40.927c-1.93-.327-4.948-.31-6.04-3.487c-1.067-3.107.438-6.67 3.742-7.045"
      />
    </svg>
  )
}
