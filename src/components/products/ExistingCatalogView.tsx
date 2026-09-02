import React from "react";
import { CustomerPortal } from "../customer/CustomerPortal";

export default function ExistingCatalogView({ categoryType }: { categoryType: string }) {
  // Me-mount portal dengan mode khusus agar logika keranjang, checkout, dan database bawaan 100% terjaga
  return <CustomerPortal standaloneCategory={categoryType} />;
}
