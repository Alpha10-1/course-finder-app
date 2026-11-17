import { useEffect, useRef } from "react";

/** Focuses the element it's attached to when it mounts (give the form a key per record). */
export default function useFocusOnMount() {
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return ref;
}
