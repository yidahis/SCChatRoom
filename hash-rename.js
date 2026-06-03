#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 压缩文件扩展名列表
const COMPRESSED_EXTENSIONS = [
  '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz', '.tar.gz', '.tar.bz2', '.tar.xz',
  '.Z', '.tgz', '.tbz2', '.txz',
  '.apk', '.jar', '.war', '.ear', '.aar',
  '.deb', '.rpm', '.pkg',
  '.dmg', '.iso', '.img',
  '.cpio', '.shar',
  '.lz', '.lzma', '.tlz'
];

/**
 * 计算文件的 MD5 哈希值
 * @param {string} filePath - 文件路径
 * @returns {Promise<string>} MD5 哈希值
 */
function calculateFileHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5');
    const stream = fs.createReadStream(filePath);

    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

/**
 * 格式化文件大小
 * @param {number} bytes - 字节数
 * @returns {string} 格式化后的大小
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 检查文件是否为压缩文件
 * @param {string} filename - 文件名
 * @returns {boolean} 是否为压缩文件
 */
function isCompressedFile(filename) {
  const lowerName = filename.toLowerCase();
  return COMPRESSED_EXTENSIONS.some(ext => lowerName.endsWith(ext));
}

/**
 * 检查文件名是否已经包含 hash（避免重复处理）
 * @param {string} filename - 文件名
 * @returns {boolean} 是否已包含 hash
 */
function hasHashInFilename(filename) {
  // 检查文件名是否包含类似 "-[32位hex]" 的模式
  const hashPattern = /-[a-f0-9]{32}(?:\.[^.]+)?$/i;
  return hashPattern.test(filename);
}

/**
 * 重命名文件，在扩展名前添加 hash
 * @param {string} filePath - 原文件路径
 * @param {string} hash - hash 值
 * @returns {Promise<string>} 新文件路径
 */
function renameFileWithHash(filePath, hash) {
  return new Promise((resolve, reject) => {
    try {
      const dir = path.dirname(filePath);
      const ext = path.extname(filePath);
      const nameWithoutExt = path.basename(filePath, ext);

      // 构建新文件名：原文件名-hash.扩展名
      const newFilename = `${nameWithoutExt}-${hash}${ext}`;
      const newPath = path.join(dir, newFilename);

      fs.rename(filePath, newPath, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve(newPath);
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * 从文件名中移除 hash 值
 * @param {string} filePath - 文件路径
 * @returns {Promise<{original: string, new: string, hash: string}>} 重命名结果
 */
function removeHashFromFilename(filePath) {
  return new Promise((resolve, reject) => {
    try {
      const dir = path.dirname(filePath);
      const ext = path.extname(filePath);
      const nameWithoutExt = path.basename(filePath, ext);

      // 匹配 "-[32位hex]" 模式
      const hashPattern = /-([a-f0-9]{32})$/i;
      const match = nameWithoutExt.match(hashPattern);

      if (!match) {
        resolve({ original: path.basename(filePath), new: path.basename(filePath), hash: null });
        return;
      }

      const hash = match[1];
      const newNameWithoutExt = nameWithoutExt.replace(hashPattern, '');
      const newFilename = `${newNameWithoutExt}${ext}`;
      const newPath = path.join(dir, newFilename);

      fs.rename(filePath, newPath, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve({
            original: path.basename(filePath),
            new: newFilename,
            hash: hash
          });
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * 处理目录
 * @param {string} dirPath - 目录路径
 * @param {Object} options - 选项
 * @returns {Promise<Object>} 处理结果
 */

/**
 * 处理目录
 * @param {string} dirPath - 目录路径
 * @param {Object} options - 选项
 * @returns {Promise<Object>} 处理结果
 */
async function processDirectory(dirPath, options = {}) {
  const {
    recursive = true,
    skipHashed = true,
    verbose = false,
    removeHash = false
  } = options;

  const results = {
    total: 0,
    processed: 0,
    skipped: 0,
    errors: 0,
    renamedFiles: []
  };

  const mode = removeHash ? '移除hash' : '添加hash';
  console.log(`\n📁 扫描目录: ${dirPath}`);
  console.log(`   模式: ${mode}`);
  console.log(`   递归扫描: ${recursive ? '是' : '否'}`);
  console.log(`   跳过已hash: ${skipHashed ? '是' : '否'}\n`);

  async function scanDirectory(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (recursive) {
          await scanDirectory(fullPath);
        }
      } else if (entry.isFile()) {
        results.total++;

        // 检查是否为压缩文件
        if (!isCompressedFile(entry.name)) {
          results.skipped++;
          if (verbose) {
            console.log(`⏭️  跳过 (非压缩文件): ${entry.name}`);
          }
          continue;
        }

        // 移除 hash 模式
        if (removeHash) {
          // 只处理包含 hash 的文件
          if (!hasHashInFilename(entry.name)) {
            results.skipped++;
            if (verbose) {
              console.log(`⏭️  跳过 (不包含hash): ${entry.name}`);
            }
            continue;
          }

          try {
            const stats = fs.statSync(fullPath);
            console.log(`\n🔍 处理文件: ${entry.name}`);
            console.log(`   大小: ${formatFileSize(stats.size)}`);

            // 移除 hash
            console.log(`   移除hash...`);
            const result = await removeHashFromFilename(fullPath);

            if (result.hash) {
              const relativePath = path.relative(dirPath, path.join(path.dirname(fullPath), result.new));
              console.log(`   移除的hash: ${result.hash}`);
              console.log(`   ✅ 已重命名: ${result.new}`);

              results.processed++;
              results.renamedFiles.push({
                original: result.original,
                renamed: result.new,
                hash: result.hash,
                action: 'remove',
                path: relativePath
              });
            } else {
              results.skipped++;
              console.log(`   ⏭️  跳过: 文件名不包含hash`);
            }
          } catch (error) {
            results.errors++;
            console.error(`   ❌ 处理失败: ${error.message}`);
          }
        } else {
          // 添加 hash 模式
          // 检查是否已包含 hash
          if (skipHashed && hasHashInFilename(entry.name)) {
            results.skipped++;
            if (verbose) {
              console.log(`⏭️  跳过 (已包含hash): ${entry.name}`);
            }
            continue;
          }

          // 计算文件 hash
          try {
            const stats = fs.statSync(fullPath);
            console.log(`\n🔍 处理文件: ${entry.name}`);
            console.log(`   大小: ${formatFileSize(stats.size)}`);

            process.stdout.write('   计算hash...');
            const hash = await calculateFileHash(fullPath);
            console.log(' ✅');
            console.log(`   Hash: ${hash}`);

            // 重命名文件
            console.log(`   重命名...`);
            const newPath = await renameFileWithHash(fullPath, hash);
            const relativePath = path.relative(dirPath, newPath);

            console.log(`   ✅ 已重命名: ${path.basename(newPath)}`);

            results.processed++;
            results.renamedFiles.push({
              original: entry.name,
              renamed: path.basename(newPath),
              hash: hash,
              action: 'add',
              path: relativePath
            });
          } catch (error) {
            results.errors++;
            console.error(`   ❌ 处理失败: ${error.message}`);
          }
        }
      }
    }
  }

  await scanDirectory(dirPath);

  return results;
}

/**
 * 打印结果摘要
 * @param {Object} results - 处理结果
 */
function printSummary(results) {
  console.log('\n' + '='.repeat(60));
  console.log('📊 处理结果摘要');
  console.log('='.repeat(60));
  console.log(`   总文件数: ${results.total}`);
  console.log(`   处理成功: ${results.processed}`);
  console.log(`   跳过文件: ${results.skipped}`);
  console.log(`   处理失败: ${results.errors}`);
  console.log('='.repeat(60));

  if (results.renamedFiles.length > 0) {
    console.log('\n📝 重命名文件列表:');
    results.renamedFiles.forEach((file, index) => {
      if (file.action === 'remove') {
        console.log(`   ${index + 1}. ${file.original}`);
        console.log(`      → ${file.renamed} (移除hash: ${file.hash})`);
      } else {
        console.log(`   ${index + 1}. ${file.original}`);
        console.log(`      → ${file.renamed} (添加hash: ${file.hash})`);
      }
    });
  }
}

/**
 * 生成报告文件
 * @param {Object} results - 处理结果
 * @param {string} outputDir - 输出目录
 */
function generateReport(results, outputDir) {
  const reportPath = path.join(outputDir, 'hash-rename-report.json');
  const reportData = {
    timestamp: new Date().toISOString(),
    summary: {
      total: results.total,
      processed: results.processed,
      skipped: results.skipped,
      errors: results.errors
    },
    renamedFiles: results.renamedFiles
  };

  fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
  console.log(`\n📄 报告已保存: ${reportPath}`);
}

// 命令行参数解析
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    path: '.',
    recursive: true,
    skipHashed: true,
    verbose: false,
    report: false,
    removeHash: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '-r':
      case '--recursive':
        options.recursive = true;
        break;
      case '-nr':
      case '--no-recursive':
        options.recursive = false;
        break;
      case '-s':
      case '--skip-hashed':
        options.skipHashed = true;
        break;
      case '-ns':
      case '--no-skip-hashed':
        options.skipHashed = false;
        break;
      case '-v':
      case '--verbose':
        options.verbose = true;
        break;
      case '--report':
        options.report = true;
        break;
      case '--remove':
        options.removeHash = true;
        break;
      case '-h':
      case '--help':
        printHelp();
        process.exit(0);
      default:
        if (!arg.startsWith('-')) {
          options.path = arg;
        }
    }
  }

  return options;
}

/**
 * 打印帮助信息
 */
function printHelp() {
  console.log(`
用法: node hash-rename.js [选项] [目录]

选项:
  --remove              从文件名中移除hash值 (默认: 添加hash)
  -r, --recursive       递归扫描子目录 (默认: true)
  -nr, --no-recursive  不递归扫描
  -s, --skip-hashed    跳过已包含hash的文件 (默认: true)
  -ns, --no-skip-hashed  不跳过已包含hash的文件
  -v, --verbose         显示详细信息
  --report              生成处理报告
  -h, --help           显示帮助信息

示例:
  # 为文件添加hash (默认模式)
  node hash-rename.js

  # 从文件名移除hash
  node hash-rename.js --remove

  # 处理指定目录
  node hash-rename.js /path/to/files

  # 不递归扫描
  node hash-rename.js --no-recursive

  # 重新处理已包含hash的文件
  node hash-rename.js --no-skip-hashed

  # 详细模式
  node hash-rename.js --verbose

  # 生成报告
  node hash-rename.js --report

  # 组合使用：移除hash并生成报告
  node hash-rename.js --remove --report

支持的压缩文件格式:
  ${COMPRESSED_EXTENSIONS.join(', ')}
`);
}

// 主函数
async function main() {
  const options = parseArgs();

  if (options.removeHash) {
    console.log('🔧 压缩文件 Hash 移除工具');
  } else {
    console.log('🔧 压缩文件 Hash 添加工具');
  }
  console.log('='.repeat(60));

  // 检查目录是否存在
  if (!fs.existsSync(options.path)) {
    console.error(`\n❌ 错误: 目录不存在 - ${options.path}`);
    process.exit(1);
  }

  if (!fs.statSync(options.path).isDirectory()) {
    console.error(`\n❌ 错误: 不是目录 - ${options.path}`);
    process.exit(1);
  }

  try {
    const results = await processDirectory(options.path, options);
    printSummary(results);

    if (options.report) {
      generateReport(results, options.path);
    }

    console.log('\n✅ 处理完成!');
  } catch (error) {
    console.error(`\n❌ 错误: ${error.message}`);
    process.exit(1);
  }
}

// 运行主函数
if (require.main === module) {
  main();
}

module.exports = {
  calculateFileHash,
  isCompressedFile,
  hasHashInFilename,
  renameFileWithHash,
  removeHashFromFilename,
  processDirectory
};
