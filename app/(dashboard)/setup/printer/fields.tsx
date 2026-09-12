'use client';

// The printer modal's fields (setup::printer.index). `PrinterRequest` required
// every one of them.

import { FormInput } from '@/components/erp/fields';

export function PrinterFields({
  defaults,
}: {
  defaults: {
    connectionType: string;
    charPerLine: string;
    ip: string;
    port: string;
    path: string;
  };
}) {
  return (
    <>
      <FormInput
        label="Connection Type"
        name="connection_type"
        required
        defaultValue={defaults.connectionType}
      />
      <FormInput
        label="Characters per line"
        name="char_per_line"
        required
        defaultValue={defaults.charPerLine}
      />
      <FormInput label="IP Address" name="ip" required defaultValue={defaults.ip} />
      <FormInput label="Port" name="port" required defaultValue={defaults.port} />
      <FormInput label="Path" name="path" required defaultValue={defaults.path} />
    </>
  );
}
