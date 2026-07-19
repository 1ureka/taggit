import type { PageData } from "../$types";
import { getContext, setContext } from "svelte";

const key = Symbol("page-data");

export const createPageDataContext = (getData: () => PageData) => {
  const context = {
    get value() {
      return getData();
    },
  };
  setContext(key, context);
  return context;
};

export const getPageDataContext = () => getContext<{ readonly value: PageData }>(key);
