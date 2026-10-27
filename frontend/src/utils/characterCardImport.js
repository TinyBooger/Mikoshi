export const CHARACTER_CARD_IMPORT_MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 16_000_000;
const MAX_IMAGE_DIMENSION = 4096;
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

const readUint32 = (bytes, offset) => (
  ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0
);

const assertPngSignature = async (file) => {
  const signature = new Uint8Array(await file.slice(0, PNG_SIGNATURE.length).arrayBuffer());
  if (!PNG_SIGNATURE.every((value, index) => signature[index] === value)) {
    throw new Error('所选文件不是有效的 PNG 图片。');
  }
};

const decodeBase64Json = (encoded) => {
  try {
    const binary = atob(encoded.replace(/\s/g, ''));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new Error('角色卡数据不是有效的 Base64 UTF-8 JSON。');
  }
};

const decodeCompressedText = async (bytes) => {
  if (typeof DecompressionStream !== 'function') {
    throw new Error('当前浏览器无法读取压缩的 PNG 角色卡文本，请改用 JSON 文件。');
  }
  try {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
    return await new Response(stream).text();
  } catch {
    throw new Error('PNG 中的压缩角色卡数据无法解压。');
  }
};

const readPngMetadata = async (file) => {
  const bytes = new Uint8Array(await file.arrayBuffer());

  const metadata = {};
  let offset = PNG_SIGNATURE.length;
  while (offset + 12 <= bytes.length) {
    const length = readUint32(bytes, offset);
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > bytes.length) {
      throw new Error('PNG 图片数据不完整或已损坏。');
    }

    const chunk = bytes.subarray(dataStart, dataEnd);
    let keywordEnd = -1;
    if (type === 'tEXt' || type === 'zTXt' || type === 'iTXt') {
      keywordEnd = chunk.indexOf(0);
    }
    if (keywordEnd > 0) {
      const keyword = new TextDecoder('latin1').decode(chunk.subarray(0, keywordEnd));
      if ((keyword === 'chara' || keyword === 'ccv3') && !metadata[keyword]) {
        let value;
        if (type === 'tEXt') {
          value = new TextDecoder('latin1').decode(chunk.subarray(keywordEnd + 1));
        } else if (type === 'zTXt') {
          if (chunk[keywordEnd + 1] !== 0) {
            throw new Error('PNG 使用了不支持的文本压缩格式。');
          }
          value = await decodeCompressedText(chunk.subarray(keywordEnd + 2));
        } else {
          let cursor = keywordEnd + 1;
          const compressionFlag = chunk[cursor++];
          const compressionMethod = chunk[cursor++];
          const languageEnd = chunk.indexOf(0, cursor);
          if (languageEnd < 0) throw new Error('PNG 国际文本块格式无效。');
          cursor = languageEnd + 1;
          const translatedKeywordEnd = chunk.indexOf(0, cursor);
          if (translatedKeywordEnd < 0) throw new Error('PNG 国际文本块格式无效。');
          cursor = translatedKeywordEnd + 1;
          if (compressionFlag === 1) {
            if (compressionMethod !== 0) {
              throw new Error('PNG 使用了不支持的文本压缩格式。');
            }
            value = await decodeCompressedText(chunk.subarray(cursor));
          } else if (compressionFlag === 0) {
            value = new TextDecoder('utf-8', { fatal: true }).decode(chunk.subarray(cursor));
          } else {
            throw new Error('PNG 国际文本块压缩标记无效。');
          }
        }
        metadata[keyword] = value;
      }
    }

    offset = dataEnd + 4;
    if (type === 'IEND') break;
  }

  return metadata;
};

const normalizePlaceholders = (text) => text
  .replace(/\{\{\s*char\s*\}\}/gi, '{{char}}')
  .replace(/\{\{\s*user\s*\}\}/gi, '{{user}}');

export const parseCharacterCard = (card) => {
  if (!card || typeof card !== 'object' || Array.isArray(card)) {
    throw new Error('角色卡 JSON 格式无效。');
  }

  let data;
  if (card.spec === 'chara_card_v2' || card.spec === 'chara_card_v3') {
    data = card.data;
  } else if (card.spec === undefined && typeof card.name === 'string') {
    data = card;
  } else if (typeof card.spec === 'string') {
    throw new Error('不支持此角色卡版本，请使用 Character Card V1、V2 或 V3。');
  } else {
    throw new Error('文件不是有效的 Character Card V1、V2 或 V3。');
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('角色卡缺少有效的角色数据。');
  }

  const name = typeof data.name === 'string' ? data.name.trim() : '';
  const originalDescription = typeof data.description === 'string' ? data.description.trim() : '';
  if (!name) throw new Error('角色卡名称不能为空。');
  if (!originalDescription) throw new Error('角色卡描述不能为空。');

  const descriptionParts = [normalizePlaceholders(originalDescription)];
  const personality = typeof data.personality === 'string' ? normalizePlaceholders(data.personality.trim()) : '';
  const scenario = typeof data.scenario === 'string' ? normalizePlaceholders(data.scenario.trim()) : '';
  if (personality) descriptionParts.push(`Personality:\n${personality}`);
  if (scenario) descriptionParts.push(`Scenario:\n${scenario}`);
  const description = descriptionParts.join('\n\n');

  const alternateGreetings = Array.isArray(data.alternate_greetings)
    ? data.alternate_greetings.filter((greeting) => typeof greeting === 'string')
    : [];
  const greetings = [
    ...(typeof data.first_mes === 'string' ? [data.first_mes] : []),
    ...alternateGreetings,
  ].map((greeting) => normalizePlaceholders(greeting.trim())).filter(Boolean);
  const rawTags = Array.isArray(data.tags) ? data.tags : [];
  const normalizedTags = [...new Set(rawTags
    .filter((tag) => typeof tag === 'string')
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean))];
  const tagsWereTrimmed = normalizedTags.length > 20;
  const tags = normalizedTags.slice(0, 20);

  return {
    name,
    description,
    tagline: typeof data.creator_notes === 'string' ? data.creator_notes.trim() : '',
    tags,
    greetings,
    sample: typeof data.mes_example === 'string' ? normalizePlaceholders(data.mes_example) : '',
    hasCharacterBook: !!data.character_book,
    tagsWereTrimmed,
  };
};

export const parseCharacterCardFile = async (file) => {
  if (!file) throw new Error('请选择 PNG 或 JSON 角色卡文件。');
  if (file.size > CHARACTER_CARD_IMPORT_MAX_FILE_SIZE) {
    throw new Error('角色卡文件不能超过 20 MB。');
  }

  const extension = file.name.split('.').pop().toLowerCase();
  if (extension === 'json') {
    let card;
    try {
      card = JSON.parse(await file.text());
    } catch {
      throw new Error('JSON 文件格式无效。');
    }
    return { card: parseCharacterCard(card), picture: null };
  }
  if (extension !== 'png') {
    throw new Error('仅支持 PNG 和 JSON 角色卡文件。');
  }

  await assertPngSignature(file);
  const picture = await reencodePng(file);
  const cardMetadata = await readPngMetadata(file);
  const encodedCard = cardMetadata.ccv3 || cardMetadata.chara;
  if (!encodedCard) {
    throw new Error('PNG 图片中没有找到角色卡数据（chara/ccv3）。');
  }

  return {
    card: parseCharacterCard(decodeBase64Json(encodedCard)),
    picture,
  };
};

const reencodePng = async (file) => {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('PNG 图片无法解码，请选择有效的 PNG 图片。');
  }

  try {
    const { width, height } = bitmap;
    if (!width || !height || width * height > MAX_IMAGE_PIXELS) {
      throw new Error('PNG 图片尺寸过大，无法安全导入。');
    }

    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('无法处理 PNG 图片。');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const cleanBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!cleanBlob) throw new Error('无法清理 PNG 图片中的角色卡元数据。');
    if (cleanBlob.size > CHARACTER_CARD_IMPORT_MAX_FILE_SIZE) {
      throw new Error('清理后的 PNG 图片超过 20 MB，无法导入。');
    }
    return new File([cleanBlob], file.name, { type: 'image/png' });
  } finally {
    bitmap.close();
  }
};
