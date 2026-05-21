import { createContext, useContext } from 'react';

export const RadarCollapseContext = createContext(false);
export const useRadarCollapsed = () => useContext(RadarCollapseContext);
