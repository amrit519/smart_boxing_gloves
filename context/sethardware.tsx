import React, { createContext, useState } from "react";

// 1. Define the shape of the context value
interface HardwareData {
  speed: Array<string>;
  punch: number;
  power: number;
}

interface HardwareDataContextType {
  hardwareData: HardwareData;
  setHardwareData: React.Dispatch<React.SetStateAction<HardwareData>>;
}

const defaultHardwareData: HardwareData = { speed: ["200"], punch: 200, power: 200 };

// 2. Create context with the correct shape
export const HardwareDataContext = createContext<HardwareDataContextType>({
  hardwareData: defaultHardwareData,
  setHardwareData: () => {},  // no-op placeholder
}); 

export const useHardware = () => React.useContext(HardwareDataContext);

// 3. Provider now matches the context type exactly
export const HardwareProvider = ({ children }: { children: React.ReactNode }) => {
  const [hardwareData, setHardwareData] = useState<HardwareData>(defaultHardwareData);

  return (
    <HardwareDataContext.Provider value={{ hardwareData, setHardwareData }}>
      {children}
    </HardwareDataContext.Provider>
  );
};
