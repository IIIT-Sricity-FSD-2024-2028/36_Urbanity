export function CommunityIllustration({ className = "" }) {
  return <svg className={className} viewBox="0 0 440 340" fill="none" aria-hidden="true">
    <circle cx="239" cy="161" r="137" fill="#e2edf4" />
    <path d="M32 291h376" stroke="#a9c0d0" strokeWidth="2" />
    <path d="M95 291V119l96-33v205" fill="#d4e3ed" stroke="#87a6bd" strokeWidth="2" />
    <path d="M191 291V86l83 28v177" fill="#f8fbfd" stroke="#87a6bd" strokeWidth="2" />
    <path d="M274 291V174l68 19v98" fill="#c6dae8" stroke="#87a6bd" strokeWidth="2" />
    {[139, 179, 219].map((y) => <g key={y}><path d={`M120 ${y}v18m40-31v18m55-5v18m35-10v18`} stroke="#587d97" strokeWidth="10" /></g>)}
    <path d="M296 211v14m25-7v14m-25 17v14m25-7v14" stroke="#587d97" strokeWidth="8" />
    <path d="M160 291v-34h25v34" fill="#183247" />
    <path d="M64 291v-39m301 39v-24" stroke="#699780" strokeWidth="4" />
    <circle cx="64" cy="244" r="21" fill="#bfdcca" /><circle cx="365" cy="259" r="16" fill="#bfdcca" />
    <rect x="303" y="77" width="70" height="54" rx="12" fill="white" stroke="#d4e2ec" strokeWidth="2" />
    <path d="m323 103 9 9 21-23" stroke="#2463d4" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}
