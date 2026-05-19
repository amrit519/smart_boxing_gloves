import React, { createContext, useState, useContext } from "react";

// ── Full hardware data shape — matches every field ESP32 sends ────────────────
export interface HardwareData {
  // Legacy fields (kept so nothing breaks)
  speed: number;
  punch: number;
  power: number;

  // Left glove — direct from ESP32 JSON L object
  l_ax:         number;
  l_ay:         number;
  l_az:         number;
  l_gx:         number;
  l_gy:         number;
  l_gz:         number;
  l_mag:        number;
  l_speed:      number;
  l_punch:      number;
  l_punch_cnt:  number;
  l_force_n:    number;
  l_peak_g:     number;
  l_punch_type: string;
  l_best_spd:   number;
  l_best_frc:   number;

  // Right glove — direct from ESP32 JSON R object
  r_ax:         number;
  r_ay:         number;
  r_az:         number;
  r_gx:         number;
  r_gy:         number;
  r_gz:         number;
  r_mag:        number;
  r_speed:      number;
  r_punch:      number;
  r_punch_cnt:  number;
  r_force_n:    number;
  r_peak_g:     number;
  r_punch_type: string;
  r_best_spd:   number;
  r_best_frc:   number;

  // Timestamp from ESP32
  ts: number;
}

interface HardwareDataContextType {
  hardwareData:    HardwareData;
  setHardwareData: React.Dispatch<React.SetStateAction<HardwareData>>;
}

// ── Zero state — all fields default to 0 / '' ─────────────────────────────────
const defaultHardwareData: HardwareData = {
  // Legacy
  speed: 0,
  punch: 0,
  power: 0,

  // Left
  l_ax: 0, l_ay: 0, l_az: 0,
  l_gx: 0, l_gy: 0, l_gz: 0,
  l_mag: 0, l_speed: 0,
  l_punch: 0, l_punch_cnt: 0,
  l_force_n: 0, l_peak_g: 0,
  l_punch_type: '',
  l_best_spd: 0, l_best_frc: 0,

  // Right
  r_ax: 0, r_ay: 0, r_az: 0,
  r_gx: 0, r_gy: 0, r_gz: 0,
  r_mag: 0, r_speed: 0,
  r_punch: 0, r_punch_cnt: 0,
  r_force_n: 0, r_peak_g: 0,
  r_punch_type: '',
  r_best_spd: 0, r_best_frc: 0,

  ts: 0,
};

// ── Context ───────────────────────────────────────────────────────────────────
export const HardwareDataContext = createContext<HardwareDataContextType>({
  hardwareData:    defaultHardwareData,
  setHardwareData: () => {},
});

export const useHardware = () => useContext(HardwareDataContext);

// ── Provider ──────────────────────────────────────────────────────────────────
export const HardwareProvider = ({ children }: { children: React.ReactNode }) => {
  const [hardwareData, setHardwareData] = useState<HardwareData>(defaultHardwareData);

  return (
    <HardwareDataContext.Provider value={{ hardwareData, setHardwareData }}>
      {children}
    </HardwareDataContext.Provider>
  );
};