const { parentPort, workerData } = require('worker_threads');
const nestingService = require('../services/nestingService');

async function run() {
  const { files, projectId, optimizationLevel, sheetWidth, sheetHeight, strategy, remnantId } = workerData;

  const onProgress = (fileId, stage, status) => {
    parentPort.postMessage({
      type: 'progress',
      fileId,
      stage,
      status
    });
  };

  try {
    const result = await nestingService.runDeepnestNext(
      files,
      projectId,
      optimizationLevel,
      sheetWidth,
      sheetHeight,
      strategy,
      onProgress,
      remnantId
    );

    parentPort.postMessage({
      type: 'success',
      result
    });
  } catch (err) {
    parentPort.postMessage({
      type: 'error',
      error: err.message || String(err)
    });
  }
}

run();
