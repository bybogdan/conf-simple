type SaveLifecycleOptions<T> = {
  save: () => Promise<T>;
  onSaved: (value: T) => void;
  onError: (message: string) => void;
  setSaving: (saving: boolean) => void;
};

export async function runEditorSave<T>({ save, onSaved, onError, setSaving }: SaveLifecycleOptions<T>) {
  setSaving(true);
  try {
    onSaved(await save());
  } catch (caught) {
    onError(caught instanceof Error ? caught.message : "Could not save page");
  } finally {
    setSaving(false);
  }
}
