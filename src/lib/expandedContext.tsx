"use client";
import { createContext, useContext } from "react";

export const ExpandedContext = createContext(false);
export const useExpanded = () => useContext(ExpandedContext);
