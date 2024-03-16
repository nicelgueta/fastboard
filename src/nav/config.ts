import { FaHome, FaInfo } from "react-icons/fa";
import { SiReadthedocs } from 'react-icons/si';

interface Subsection {
    name: string;
    link: string;
    linkDisabled: boolean;
    icon: React.ElementType;
}

interface ConfigItem {
    header: string;
    subsections: Subsection[];
}

const config: ConfigItem[] = [
    {
        header: "Home",
        subsections: [
            {
                name: "Home",
                link: "/home",
                linkDisabled: false,
                icon: FaHome
            },
            // {
            //     name: "About",
            //     link: "/home/about",
            //     linkDisabled: true,
            //     icon: FaInfo
            // },
            // {
            //     name: "User guides",
            //     link: "/home/guides",
            //     linkDisabled: true,
            //     icon: SiReadthedocs
            // },
        ]
    },
];

export default config;
