import { config } from "./config.js";

export function appendBuilderCode(calldata: `0x${string}`): `0x${string}` {
  if (!config.erc8021Enabled || !process.env.BUILDER_CODE) {
    return calldata;
  }
  return `${calldata}${process.env.BUILDER_CODE}` as `0x${string}`;
}
