import Svg, { Path } from 'react-native-svg';

interface Props {
  size?: number;
  color?: string;
}

/** WhatsApp channel mark (line style). Tinted via `color` (stroke). */
export function WhatsappIcon({ size = 16, color = '#000000' }: Readonly<Props>) {
  return (
    <Svg width={size} height={size} viewBox="4 3 18 18" fill="none">
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M13.5 19.0001C16.6157 18.9994 19.3559 16.9396 20.2224 13.9468C21.0889 10.954 19.873 7.74874 17.2396 6.0836C14.6062 4.41845 11.1892 4.69428 8.85695 6.76026C6.52471 8.82624 5.8387 12.185 7.174 15.0001L5.5 19.0001L9.892 18.0001C10.9809 18.6564 12.2286 19.0022 13.5 19.0001Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M11.541 11.0661C10.9717 11.0611 10.5137 10.5965 10.517 10.0271C10.5203 9.45781 10.9836 8.99849 11.5529 9.00013C12.1223 9.00177 12.5829 9.46375 12.583 10.0331C12.5802 10.606 12.1139 11.0683 11.541 11.0661V11.0661Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M14.417 13.918C14.4138 14.3397 14.6652 14.7217 15.0538 14.8854C15.4424 15.0491 15.8914 14.9622 16.1909 14.6653C16.4904 14.3684 16.5811 13.9202 16.4208 13.5302C16.2605 13.1402 15.8807 12.8854 15.459 12.885C14.8861 12.8828 14.4198 13.3451 14.417 13.918V13.918Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M10.5 10.0331C10.486 13.5001 13.8 15.3301 15.459 14.9511"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </Svg>
  );
}
