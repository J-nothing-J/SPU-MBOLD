import os


if os.getenv('JAWSDB_URL'):
	try:
		import pymysql
	except ImportError as exc:
		raise RuntimeError('PyMySQL is required when JAWSDB_URL is set.') from exc

	pymysql.install_as_MySQLdb()
