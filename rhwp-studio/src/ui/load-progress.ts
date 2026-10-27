export type ProgressMessage = Pick<HTMLElement, 'textContent' | 'checkVisibility'>;

export async function updateProgressMessage(
  message: ProgressMessage,
  text: string,
  waitForPaint: () => Promise<void>,
): Promise<void> {
  message.textContent = text;
  if (!message.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return;
  await waitForPaint();
}
