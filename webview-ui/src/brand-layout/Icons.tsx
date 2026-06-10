/* SVG icons ported from the original index.html */
import React from "react";

export const LogoMark = ({ size = 21 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width={size} height={size}>
    <rect x="3" y="3" width="18" height="18" rx="5" stroke="rgba(255,255,255,0.22)" strokeWidth="1.4" />
    <rect x="6.5" y="7" width="11" height="2.2" rx="1.1" fill="rgba(255,255,255,0.92)" />
    <rect x="6.5" y="11.4" width="8" height="2.2" rx="1.1" fill="rgba(255,255,255,0.4)" />
    <circle cx="15.4" cy="15.4" r="2.4" fill="var(--orange)" />
  </svg>
);

export const LogoMarkLarge = () => (
  <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" width="38" height="38">
    <rect x="5" y="5" width="30" height="30" rx="8" stroke="rgba(255,255,255,0.22)" strokeWidth="2" />
    <rect x="11" y="11.5" width="18" height="3.6" rx="1.8" fill="rgba(255,255,255,0.92)" />
    <rect x="11" y="18.8" width="13" height="3.6" rx="1.8" fill="rgba(255,255,255,0.4)" />
    <circle cx="25.5" cy="25.5" r="4" fill="var(--orange)" />
  </svg>
);

export const FolderIcon = () => (
  <svg viewBox="0 0 14 14" fill="none" width="12" height="12">
    <path d="M1.5 3.5v7A1 1 0 002.5 11.5h9a1 1 0 001-1V5.5a1 1 0 00-1-1H7L5.5 3H2.5a1 1 0 00-1 1Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
  </svg>
);

export const ShieldIcon = () => (
  <svg viewBox="0 0 14 14" fill="none" width="12" height="12">
    <path d="M7 1L2 3v3.5C2 9.5 4.2 12 7 13c2.8-1 5-3.5 5-6.5V3L7 1Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    <path d="M4.5 7l2 2 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Chevron = () => (
  <svg viewBox="0 0 10 6" width="10" height="6" fill="none">
    <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const FileIcon = () => (
  <svg className="preview-file-icon" viewBox="0 0 14 16" fill="none" width="11" height="13">
    <path d="M2 2a1 1 0 011-1h6.5l3 3V14a1 1 0 01-1 1H3a1 1 0 01-1-1V2Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    <path d="M9.5 1v3h3" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    <path d="M4 7.5h6M4 10h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

export const PlaceIcon = () => (
  <svg viewBox="0 0 16 16" width="15" height="15" fill="none">
    <path d="M8 2.5v7.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
    <path d="M5 8l3 3.5 3-3.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M3 12v1.5a.5.5 0 00.5.5h9a.5.5 0 00.5-.5V12" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const PencilIcon = () => (
  <svg viewBox="0 0 14 14" fill="none" width="13" height="13">
    <path d="M2 11.5h3.5L12 5a1.5 1.5 0 00-3-3L2.5 8.5v3Z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const ExternalIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" width="15" height="15">
    <path d="M6.5 3.5H3.5A1.5 1.5 0 002 5v8A1.5 1.5 0 003.5 14.5h8A1.5 1.5 0 0013 13v-3" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M9.5 2H14v4.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M14 2L7.5 8.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const PaletteIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" width="15" height="15">
    <circle cx="8" cy="8" r="5.5" stroke="white" strokeWidth="1.5" />
    <circle cx="6" cy="6.5" r="1.4" fill="white" />
    <circle cx="10" cy="6.5" r="1.4" fill="white" />
    <circle cx="8" cy="10.5" r="1.4" fill="white" />
  </svg>
);

export const FontIcon = () => (
  <svg viewBox="0 0 16 14" fill="none" width="14" height="12">
    <path d="M2 12.5h12M8 2.5v10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    <path d="M5 5.5l3-3 3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const CheckIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" width="15" height="15">
    <path d="M2.5 8.5l4 4 7-8" stroke="white" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* Tab icons */
export const TabPlace = () => (
  <svg className="tab-ico" viewBox="0 0 20 20" fill="none" width="18" height="18">
    <rect x="2.5" y="3" width="15" height="4.5" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
    <rect x="2.5" y="9.5" width="15" height="3" rx="1.5" stroke="currentColor" strokeWidth="1.4" opacity="0.6" />
    <rect x="2.5" y="14.5" width="15" height="2" rx="1" stroke="currentColor" strokeWidth="1.3" opacity="0.3" />
  </svg>
);

export const TabBrands = () => (
  <svg className="tab-ico" viewBox="0 0 20 20" fill="none" width="18" height="18">
    <path d="M10 2.5L17.5 10L10 17.5L2.5 10Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M10 7L13 10L10 13L7 10Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" opacity="0.45" />
  </svg>
);

export const TabSettings = () => (
  <svg className="tab-ico" viewBox="0 0 20 20" fill="none" width="18" height="18">
    <line x1="3" y1="5.5" x2="17" y2="5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    <line x1="3" y1="10" x2="17" y2="10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    <line x1="3" y1="14.5" x2="17" y2="14.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    <circle cx="7.5" cy="5.5" r="2.3" stroke="currentColor" strokeWidth="1.3" />
    <circle cx="12.5" cy="10" r="2.3" stroke="currentColor" strokeWidth="1.3" />
    <circle cx="8.5" cy="14.5" r="2.3" stroke="currentColor" strokeWidth="1.3" />
  </svg>
);

export const TabAbout = () => (
  <svg className="tab-ico" viewBox="0 0 20 20" fill="none" width="18" height="18">
    <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.4" />
    <path d="M10 9.5v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="10" cy="6.5" r="1" fill="currentColor" />
  </svg>
);
