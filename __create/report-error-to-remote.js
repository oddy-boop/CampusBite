let serializeError;

const getSerializeError = async () => {
  if (!serializeError) {
    const module = await import('serialize-error');
    serializeError = module.serializeError;
  }
  return serializeError;
};

const reportErrorToRemote = async ({ error }) => {
  if (
    !process.env.EXPO_PUBLIC_LOGS_ENDPOINT ||
    !process.env.EXPO_PUBLIC_PROJECT_GROUP_ID ||
    !process.env.EXPO_PUBLIC_CREATE_TEMP_API_KEY
  ) {
    console.debug(
      'reportErrorToRemote: Missing environment variables for logging endpoint, project group ID, or API key.',
      error
    );
    return { success: false };
  }
  try {
    const serialize = await getSerializeError();
    await fetch(process.env.EXPO_PUBLIC_LOGS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.EXPO_PUBLIC_CREATE_TEMP_API_KEY}`,
      },
      body: JSON.stringify({
        error: serialize(error),
        projectGroupId: process.env.EXPO_PUBLIC_PROJECT_GROUP_ID,
      }),
    });
  } catch (fetchError) {
    return { success: false, error: fetchError };
  }
  return { success: true };
;

