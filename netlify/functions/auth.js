const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const pool = new Pool({
    connectionString: process.env.NETLIFY_DATABASE_URL
});

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { type, email, password, name } = JSON.parse(event.body);

        if (type === 'login') {
            const { rows } = await pool.query(
                'SELECT * FROM users WHERE email = $1',
                [email]
            );
y

            if (rows.length === 0) {
                return {
                    statusCode: 401,
                    body: JSON.stringify({ success: false, message: 'User not found' })
                };
            }

            const validPassword = await bcrypt.compare(password, rows[0].password);
            if (!validPassword) {
                return {
                    statusCode: 401,
                    body: JSON.stringify({ success: false, message: 'Invalid password' })
                };
            }

            const token = jwt.sign({ userId: rows[0].id }, process.env.JWT_SECRET);
            return {
                statusCode: 200,
                body: JSON.stringify({ success: true, token })
            };
        }

        if (type === 'signup') {
            const hashedPassword = await bcrypt.hash(password, 10);

            const { rows } = await pool.query(
                'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id',
                [name, email, hashedPassword]
            );

            const token = jwt.sign({ userId: rows[0].id }, process.env.JWT_SECRET);
            return {
                statusCode: 200,
                body: JSON.stringify({ success: true, token })
            };
        }

    } catch (error) {
        console.error('Auth error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ success: false, message: 'Internal server error' })
        };
    }
};
