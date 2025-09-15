import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer className="text-center text-gray-500 text-sm mt-12 pt-6 border-t border-gray-100">
      <p>Forex data is provided by Nepal Rastra Bank</p>
      <p className="mt-2">Made with ❤️ by <a href="https://grisma.com.np" target="_blank" rel="noopener noreferrer" className="hover:text-primary">Grisma Blog</a></p>
      <p className="mt-1">© {new Date().getFullYear()} <a href="https://grisma.com.np" target="_blank" rel="noopener noreferrer" className="hover:text-primary">Grisma Blog</a></p>
      <div className="mt-3 space-y-1">
        <div>
          <Link to="/privacy-policy" className="hover:text-primary mr-4">Privacy Policy</Link>
          <Link to="/about" className="hover:text-primary mr-4">About</Link>
          <Link to="/disclosure" className="hover:text-primary mr-4">Disclosure</Link>
          <a href="https://grisma.com.np/contact" target="_blank" rel="noopener noreferrer" className="hover:text-primary">Contact</a>
        </div>
        <p className="text-xs text-gray-400">
          We do not collect user data. For full privacy policy, visit{' '}
          <a href="https://grisma.com.np/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-primary">grisma.com.np/privacy</a>
        </p>
      </div>
    </footer>
  );
};

export default Footer;