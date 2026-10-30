import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SOURCE_DBS = [
    'Apex_db',
    'Circa_db',
    'Dispo_db',
    'LabProject_db',
    'Locus_db',
    'Silo_db',
];

async function syncTestDatabases() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error('HATA: MONGODB_URI bulunamadı (.env dosyasını kontrol edin).');
        process.exit(1);
    }

    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log('MongoDB bağlantısı kuruldu. Canlı -> Test veritabanı senkronizasyonu başlıyor...\n');

        for (const sourceDbName of SOURCE_DBS) {
            const targetDbName = sourceDbName.replace(/_db$/, '_test_db');

            // Güvenlik kilidi: Hedef veritabanı kesinlikle _test_db ile bitmelidir.
            if (!targetDbName.endsWith('_test_db') || targetDbName === sourceDbName) {
                throw new Error(`Güvenlik kilidi tetiklendi: Geçersiz hedef DB adı (${targetDbName})`);
            }

            const sourceDb = client.db(sourceDbName);
            const targetDb = client.db(targetDbName);

            const collections = await sourceDb.listCollections().toArray();
            console.log(`▶ ${sourceDbName} -> ${targetDbName} (${collections.length} koleksiyon)`);

            // Hedefte olup kaynakta olmayan eski test koleksiyonlarını temizle
            const targetCollections = await targetDb.listCollections().toArray();
            const sourceColNames = new Set(collections.map((c) => c.name));
            for (const tc of targetCollections) {
                if (!sourceColNames.has(tc.name)) {
                    await targetDb.collection(tc.name).drop();
                }
            }

            for (const colInfo of collections) {
                const colName = colInfo.name;
                const sourceCol = sourceDb.collection(colName);
                const targetCol = targetDb.collection(colName);

                const docs = await sourceCol.find({}).toArray();

                // Hedef test koleksiyonunu sıfırla ve verileri aktar
                await targetCol.deleteMany({});
                if (docs.length > 0) {
                    await targetCol.insertMany(docs, { ordered: false });
                }

                // Özel indeksleri kopyala (_id_ hariç)
                const indexes = await sourceCol.indexes();
                for (const idx of indexes) {
                    if (idx.name === '_id_') continue;
                    const { key, name, unique, sparse, expireAfterSeconds } = idx;
                    const options = { name };
                    if (unique !== undefined) options.unique = unique;
                    if (sparse !== undefined) options.sparse = sparse;
                    if (expireAfterSeconds !== undefined) options.expireAfterSeconds = expireAfterSeconds;
                    await targetCol.createIndex(key, options);
                }

                console.log(`   ✓ ${colName}: ${docs.length} kayıt kopyalandı`);
            }
        }

        console.log('\n✅ Tüm canlı veritabanları başarıyla *_test_db veritabanlarına kopyalandı!');
    } catch (err) {
        console.error('\n❌ Senkronizasyon hatası:', err);
        process.exit(1);
    } finally {
        await client.close();
    }
}

syncTestDatabases();
