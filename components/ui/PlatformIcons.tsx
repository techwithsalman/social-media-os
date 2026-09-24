import React from 'react';

interface PlatformIconProps {
  platform: string;
  className?: string;
  size?: number;
}

export const PlatformIcon: React.FC<PlatformIconProps> = ({
  platform,
  className = 'w-5 h-5',
  size = 20,
}) => {
  const norm = platform?.toUpperCase();

  switch (norm) {
    case 'INSTAGRAM':
      return (
        <svg
          className={className}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect width="24" height="24" rx="6" fill="url(#ig-grad)" />
          <path
            d="M12 7.00002C9.23858 7.00002 7 9.2386 7 12C7 14.7614 9.23858 17 12 17C14.7614 17 17 14.7614 17 12C17 9.2386 14.7614 7.00002 12 7.00002ZM12 15.2C10.2327 15.2 8.8 13.7673 8.8 12C8.8 10.2327 10.2327 8.80002 12 8.80002C13.7673 8.80002 15.2 10.2327 15.2 12C15.2 13.7673 13.7673 15.2 12 15.2ZM17.2 7.80002C17.2 8.35231 16.7523 8.80002 16.2 8.80002C15.6477 8.80002 15.2 8.35231 15.2 7.80002C15.2 7.24774 15.6477 6.80002 16.2 6.80002C16.7523 6.80002 17.2 7.24774 17.2 7.80002Z"
            fill="white"
          />
          <defs>
            <radialGradient
              id="ig-grad"
              cx="0"
              cy="0"
              r="1"
              gradientUnits="userSpaceOnUse"
              gradientTransform="translate(6 21) rotate(-55.77) scale(22.38 21.9)"
            >
              <stop stopColor="#FFD521" />
              <stop offset="0.32" stopColor="#F50000" />
              <stop offset="0.66" stopColor="#B900B4" />
              <stop offset="1" stopColor="#3C00A0" />
            </radialGradient>
          </defs>
        </svg>
      );

    case 'FACEBOOK':
      return (
        <svg
          className={className}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="#1877F2"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"
          />
        </svg>
      );

    case 'TIKTOK':
      return (
        <svg
          className={className}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect width="24" height="24" rx="6" fill="#000000" />
          <path
            d="M16.6 8.2C15.6 8.1 14.7 7.5 14.2 6.6C14 6.2 13.9 5.8 13.8 5.3H11.2V15C11.1 16.2 10.1 17.1 8.9 17C7.8 16.9 6.9 15.9 7 14.8C7.1 13.7 8.1 12.8 9.2 12.9V10.3C6.7 10.2 4.6 12.1 4.5 14.6C4.4 17.2 6.4 19.4 9 19.5C11.6 19.6 13.8 17.6 13.8 15V10.4C14.9 11.2 16.2 11.7 17.6 11.7V9.1C17.2 9.1 16.9 8.8 16.6 8.2Z"
            fill="#25F4EE"
          />
          <path
            d="M17.6 8.7C16.4 8.7 15.3 8 14.8 7C14.5 6.4 14.4 5.9 14.3 5.3H12.3V15C12.2 16.7 10.8 18 9.1 17.9C7.5 17.8 6.3 16.4 6.4 14.8C6.5 13.3 7.9 12.1 9.4 12.2V10.8C7.3 10.7 5.5 12.3 5.4 14.5C5.3 16.7 7 18.6 9.2 18.7C11.4 18.8 13.3 17.1 13.3 14.9V9.8C14.6 10.7 16.1 11.2 17.6 11.2V8.7Z"
            fill="#FE2C55"
          />
        </svg>
      );

    case 'LINKEDIN':
      return (
        <svg
          className={className}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="#0A66C2"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v7.6h2.8v-7.6h-2.8M7.86 6.5a1.63 1.63 0 1 0 1.63 1.62A1.63 1.63 0 0 0 7.86 6.5z" />
        </svg>
      );

    case 'YOUTUBE':
      return (
        <svg
          className={className}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="#FF0000"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
      );

    case 'X':
    case 'TWITTER':
      return (
        <svg
          className={className}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );

    case 'PINTEREST':
      return (
        <svg
          className={className}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect width="24" height="24" rx="6" fill="#E60023" />
          <path
            d="M12.1 4.5C8 4.5 5.6 7.2 5.6 10.1c0 1.8.9 3.4 2.2 4 .2.1.4 0 .5-.2l.2-.9c.1-.3.1-.4-.1-.6-.4-.5-.7-1.1-.7-2 0-2.3 1.7-4.4 4.3-4.4 2.4 0 3.7 1.5 3.7 3.4 0 2.6-1.1 4.8-2.8 4.8-.9 0-1.6-.8-1.4-1.7.3-1.1.8-2.3.8-3.1 0-.7-.4-1.3-1.2-1.3-.9 0-1.7 1-1.7 2.3 0 .8.3 1.4.3 1.4l-1.2 5.1c-.3 1.3 0 2.9 0 3 .1.2.3.2.4.1.2-.2 1.9-2.3 2.5-4.5l.4-1.5c.4.8 1.4 1.4 2.5 1.4 3.2 0 5.4-2.9 5.4-6.8 0-2.9-2.5-5.6-6.3-5.6Z"
            fill="white"
          />
        </svg>
      );

    case 'SNAPCHAT':
      return (
        <svg
          className={className}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect width="24" height="24" rx="6" fill="#FFFC00" />
          <path
            d="M12 4.2c2 0 3.5 1.5 3.5 3.7v2.1c0 .3.2.5.5.5.4 0 .8-.3 1.1-.3.4 0 .7.3.7.6 0 .5-.6.8-1.3 1-.4.1-.6.4-.4.8.4 1.1 1.3 1.8 2.6 2.2.3.1.5.4.4.8-.1.3-.4.5-.7.6-.7.1-1.3.3-1.6.7-.3.4-.8.5-1.3.4-.5-.1-1-.1-1.5.2-.5.3-1 .9-1.7.9s-1.2-.6-1.7-.9c-.5-.3-1-.3-1.5-.2-.5.1-1 0-1.3-.4-.3-.4-.9-.6-1.6-.7-.3-.1-.6-.3-.7-.6-.1-.4.1-.7.4-.8 1.3-.4 2.2-1.1 2.6-2.2.2-.4 0-.7-.4-.8-.7-.2-1.3-.5-1.3-1 0-.3.3-.6.7-.6.3 0 .7.3 1.1.3.3 0 .5-.2.5-.5V7.9c0-2.2 1.5-3.7 3.5-3.7Z"
            fill="white"
            stroke="#111827"
            strokeWidth="1.1"
            strokeLinejoin="round"
          />
        </svg>
      );

    default:
      return (
        <div
          className={`flex items-center justify-center rounded-md bg-indigo-600 text-white font-bold text-xs ${className}`}
        >
          {platform?.slice(0, 2)?.toUpperCase()}
        </div>
      );
  }
};
