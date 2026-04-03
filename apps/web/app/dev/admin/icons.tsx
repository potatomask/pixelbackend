import React from "react";

type IconProps = {
  size?: number;
  stroke?: string;
  strokeWidth?: number;
  style?: React.CSSProperties;
};

function Svg({ size = 18, stroke = "currentColor", strokeWidth = 1.8, style, children }: React.PropsWithChildren<IconProps>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block", ...style }}
    >
      <g stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
        {children}
      </g>
    </svg>
  );
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M19 12H5" />
      <path d="M12 19L5 12L12 5" />
    </Svg>
  );
}

export function BarChartIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 20V10" />
      <path d="M10 20V4" />
      <path d="M16 20V13" />
      <path d="M22 20V7" />
    </Svg>
  );
}

export function UsersIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M16 21V19C16 17.3431 14.6569 16 13 16H7C5.34315 16 4 17.3431 4 19V21" />
      <circle cx="10" cy="8" r="4" />
      <path d="M20 21V19C20 17.7544 19.228 16.6894 18.1387 16.254" />
      <path d="M15.5 4.25403C16.5898 4.68877 17.362 5.75403 17.362 7C17.362 8.24597 16.5898 9.31123 15.5 9.74597" />
    </Svg>
  );
}

export function RocketIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 19C6.5 17.5 8 17 10 17L7 20C6 20 5.5 19.5 5 19Z" />
      <path d="M17 14C20.5 10.5 20 4 20 4C20 4 13.5 3.5 10 7L8 9C7.33333 9.66667 7 10.6667 7 12L12 17C13.3333 17 14.3333 16.6667 15 16L17 14Z" />
      <circle cx="15" cy="9" r="1.5" />
      <path d="M9 15L5 19" />
    </Svg>
  );
}

export function DoorIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 21H19" />
      <path d="M8 21V5C8 4.44772 8.44772 4 9 4H17C17.5523 4 18 4.44772 18 5V21" />
      <path d="M12 12H12.01" />
      <path d="M3 21V3" />
    </Svg>
  );
}

export function MessageSquareIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M21 15C21 16.6569 19.6569 18 18 18H8L3 21V6C3 4.34315 4.34315 3 6 3H18C19.6569 3 21 4.34315 21 6V15Z" />
      <path d="M8 9H16" />
      <path d="M8 13H13" />
    </Svg>
  );
}

export function MailIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M4 7L12 13L20 7" />
    </Svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20L16 16" />
    </Svg>
  );
}

export function SparklesIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3L13.8 8.2L19 10L13.8 11.8L12 17L10.2 11.8L5 10L10.2 8.2L12 3Z" />
      <path d="M19 3L19.8 5.2L22 6L19.8 6.8L19 9L18.2 6.8L16 6L18.2 5.2L19 3Z" />
    </Svg>
  );
}

export function GlobeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12H21" />
      <path d="M12 3C14.5 5.5 16 8.6 16 12C16 15.4 14.5 18.5 12 21" />
      <path d="M12 3C9.5 5.5 8 8.6 8 12C8 15.4 9.5 18.5 12 21" />
    </Svg>
  );
}

export function TrendingUpIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M22 7L13.5 15.5L9 11L2 18" />
      <path d="M16 7H22V13" />
    </Svg>
  );
}

export function GridIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </Svg>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Svg>
  );
}