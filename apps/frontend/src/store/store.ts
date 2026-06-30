import { configureStore } from "@reduxjs/toolkit";
import { api } from "./api";
// Ensure feature endpoints are injected before the store is created.
import "./examsApi";
import "./questionsApi";
import "./studentsApi";
import "./assignmentsApi";
import "./adminApi";
import "./studentApi";
import "./attemptsApi";

export function createStore() {
  return configureStore({
    reducer: {
      [api.reducerPath]: api.reducer,
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(api.middleware),
  });
}

export const store = createStore();

export type AppStore = ReturnType<typeof createStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
